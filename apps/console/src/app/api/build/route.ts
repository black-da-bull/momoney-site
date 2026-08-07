import { NextRequest } from "next/server";
import { getProject } from "@/lib/store";
import { runBuild } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Streams the run as JSON-lines: {type:"stage"|"review"|"foil"|"done"|"error", ...}
export async function POST(req: NextRequest) {
  const { projectId } = (await req.json()) as { projectId: string };
  if (!projectId) return Response.json({ error: "projectId required" }, { status: 400 });

  const project = await getProject(projectId);
  if (!project) return Response.json({ error: "unknown project" }, { status: 404 });

  // The factory and chat runtime are OpenAI-backed. Keep provider admission checks
  // consistent so a successful chat BUILD signal cannot launch a factory that
  // immediately rejects the request on a stale Anthropic credential requirement.
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY is not set for this Vercel environment." },
      { status: 503 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // The client may have disconnected. runBuild still persists stage state.
        }
      };

      // Immediate transport acknowledgement prevents the UI from presenting an
      // unqualified "rolling" state before the server has admitted the build.
      emit({ type: "stage", name: "runtime-admission", status: "done" });

      try {
        await runBuild(project, emit);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "build failed" });
      } finally {
        try {
          controller.close();
        } catch {
          // Client disconnected; persisted build state remains authoritative.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
