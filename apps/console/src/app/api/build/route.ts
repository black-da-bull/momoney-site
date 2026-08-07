import { NextRequest } from "next/server";
import { getDbProject } from "@/lib/maestro/db";
import { runMaestroEndToEnd } from "@/lib/maestro/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { projectId } = (await req.json()) as { projectId?: string };
  if (!projectId) return Response.json({ error: "projectId required" }, { status: 400 });
  const project = await getDbProject(projectId);
  if (!project) return Response.json({ error: "unknown project" }, { status: 404 });
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "OPENAI_API_KEY is not configured for Preview" }, { status: 503 });
  if (!project.seedRaw?.trim()) return Response.json({ error: "Add the song concept/specification/lyrics before BUILD" }, { status: 409 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: Record<string, unknown>) => {
        try { controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); } catch { /* client disconnected */ }
      };
      emit({ type: "stage", name: "runtime-admission", status: "done", runtime: "maestro-v0.2" });
      try {
        await runMaestroEndToEnd(projectId, emit);
      } catch (error) {
        emit({ type: "error", message: error instanceof Error ? error.message : "Maestro runtime failed" });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
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
