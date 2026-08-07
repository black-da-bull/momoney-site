import Anthropic from "@/lib/openai-anthropic-compat";
import { NextRequest } from "next/server";
import { loadSoul } from "@/lib/soul";
import { loadStandards } from "@/lib/standards";
import { getProject, save, appendChange } from "@/lib/store";
import { compactUST, activeAxes, applyProposal } from "@/lib/ust";
import { detectBuildSignal } from "@/lib/buildmode";

export const runtime = "nodejs";
export const maxDuration = 60;

const CHAT_MODEL = process.env.OPENAI_MODEL || process.env.MAESTRO_MODEL || "gpt-5-mini";
const EXTRACT_MODEL = process.env.OPENAI_EXTRACT_MODEL || process.env.OPENAI_MODEL || process.env.MAESTRO_MODEL || "gpt-5-mini";

function sessionContext(title: string, ust: string, buildRequested: boolean): string {
  let ctx = `\n\n---\n\n## SESSION CONTEXT (backstage — never shown or mentioned to the artist)\n\nProject: "${title}"\n\nThe song's memory so far (your internal grid — speak plain music talk, never addresses):\n${ust}\n`;
  if (buildRequested) {
    ctx += `\nThe artist just gave a build-mode signal. The factory IS running this request — the run\npanel beside the chat shows the stages live and will present the triad when it lands.\nAcknowledge briefly, in one voice, in character (a producer saying "rolling it now" —\none or two sentences, no tour of the phases). Do NOT generate the triad in chat; the\nfactory emits it. Artist-supplied lyrics are immutable during the build: do not promise to rewrite, tighten, rescore, replace, or otherwise alter them. If meter, phrasing, or arrangement creates a feasibility concern, flag the constraint without changing the lyric text.`;
  }
  return ctx;
}

export async function POST(req: NextRequest) {
  const { projectId, message } = (await req.json()) as { projectId: string; message: string };
  if (!projectId || !message?.trim()) {
    return Response.json({ error: "projectId and message required" }, { status: 400 });
  }
  const project = await getProject(projectId);
  if (!project) return Response.json({ error: "unknown project" }, { status: 404 });
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY is not set for this Vercel environment." },
      { status: 503 },
    );
  }

  const verbatim = message;
  if (project.seedRaw == null) project.seedRaw = verbatim;
  project.messages.push({ role: "artist", text: verbatim, at: new Date().toISOString() });

  const buildRequested = detectBuildSignal(verbatim);
  const system = loadSoul() + loadStandards() + sessionContext(project.title, compactUST(project.grid), buildRequested);

  const history = project.messages
    .filter((m) => m.text.trim().length > 0)
    .slice(-30)
    .map((m) => ({
      role: m.role === "artist" ? ("user" as const) : ("assistant" as const),
      content: m.text,
    }));

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      try {
        const s = client.messages.stream({
          model: CHAT_MODEL,
          max_tokens: 1500,
          system,
          messages: history,
        });
        s.on("text", (t) => {
          reply += t;
          controller.enqueue(encoder.encode(t));
        });
        await s.finalMessage();

        if (reply.trim().length > 0) {
          project.messages.push({ role: "maestro", text: reply, at: new Date().toISOString() });
        }
        await save(project);

        try {
          await quietMemoryPass(client, project.id, verbatim, reply);
        } catch {
          // Quiet memory extraction is non-blocking by design.
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "generation failed";
        controller.enqueue(encoder.encode(`\n\n[console: ${msg} — say that again and I'll pick it right up.]`));
        try {
          await save(project);
        } catch {
          // Keep the stream closing cleanly even if persistence is unavailable.
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Build-Signal": buildRequested ? "1" : "0",
    },
  });
}

async function quietMemoryPass(
  client: Anthropic,
  projectId: string,
  artistText: string,
  maestroText: string,
) {
  const project = await getProject(projectId);
  if (!project) return;

  const axisSpec = activeAxes()
    .map((a) => `${a.code} (${a.name}): ${a.keys.join(", ")}`)
    .join("\n");

  const res = await client.messages.create({
    model: EXTRACT_MODEL,
    max_tokens: 600,
    system:
      `You extract song decisions from a studio conversation into an addressable grid. ` +
      `Only record what the exchange actually establishes or strongly implies about THIS song. ` +
      `Never invent. Empty output is normal and correct.\n\nAddresses (AXIS.key):\n${axisSpec}\n\n` +
      `Return ONLY a JSON array (no prose, no fences): ` +
      `[{"address":"THY.K1.S1","value":"<concise, <=14 words>","why":"<what in the exchange implies it>"}]`,
    messages: [
      {
        role: "user",
        content: `Current grid:\n${compactUST(project.grid)}\n\nARTIST said:\n${artistText}\n\nMAESTRO replied:\n${maestroText}`,
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  let proposals: { address: string; value: string; why: string }[] = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) proposals = parsed;
  } catch {
    return;
  }

  let touched = false;
  for (const p of proposals.slice(0, 12)) {
    if (!p?.address || !p?.value) continue;
    const result = applyProposal(project.grid, p.address, String(p.value), `maestro-inference: ${p.why || "from conversation"}`);
    if (result.ok) {
      appendChange(project, {
        address: p.address,
        from: result.prior?.value ?? null,
        to: String(p.value),
        status: "PROPOSED",
        provenance: `maestro-inference: ${p.why || "from conversation"}`,
        note: "quiet fill from conversation",
      });
      touched = true;
    }
  }
  if (touched) await save(project);
}
