import { NextRequest } from "next/server";
import { appendDbDialogue, getDbProject, nextDialogueSequence, updateDbProject } from "@/lib/maestro/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isBuild(text: string) {
  return /^(build|run|execute|render|go)$/i.test(text.trim()) || /\b(run|build|execute)\b.*\b(maestro|factory|song)\b/i.test(text);
}

export async function POST(req: NextRequest) {
  const { projectId, message } = (await req.json()) as { projectId?: string; message?: string };
  if (!projectId || !message?.trim()) return Response.json({ error: "projectId and message required" }, { status: 400 });
  const project = await getDbProject(projectId);
  if (!project) return Response.json({ error: "unknown project" }, { status: 404 });

  const text = message.trim();
  const buildRequested = isBuild(text);
  const seq = await nextDialogueSequence(projectId);
  await appendDbDialogue({
    id: `dlg-${projectId}-${seq}`,
    projectId,
    sequence: seq,
    kind: "OPERATOR_INPUT",
    speakerId: "operator",
    speakerType: "HUMAN",
    text,
    targetAddresses: [],
    evidenceRefs: [],
    createdAt: new Date().toISOString(),
  });

  if (!buildRequested) {
    const seedRaw = project.seedRaw ? `${project.seedRaw}\n\n--- OPERATOR DELTA ---\n${text}` : text;
    await updateDbProject(projectId, { seedRaw });
  }

  const reply = buildRequested
    ? "BUILD received. The staffed Maestro runtime is taking the current song through Technical UST resolution, interwoven SEM pressure, round-robin challenge, red-pen, definitive lock, FOIL, and derivative surfaces. The factory panel is the execution record."
    : "Captured as operator source material. I have not rewritten or silently normalized it. When you send BUILD, the staffed runtime will work this state end-to-end.";

  const replySeq = await nextDialogueSequence(projectId);
  await appendDbDialogue({
    id: `dlg-${projectId}-${replySeq}`,
    projectId,
    sequence: replySeq,
    kind: "SYSTEM_NOTE",
    speakerId: "controller",
    speakerType: "SYSTEM",
    text: reply,
    targetAddresses: [],
    evidenceRefs: [],
    createdAt: new Date().toISOString(),
  });

  return new Response(reply, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Build-Signal": buildRequested ? "1" : "0",
    },
  });
}
