import { NextRequest } from "next/server";
import { getProject } from "@/lib/store";
import { runBuild } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300; // the factory takes real time (Vercel Pro allows 300s)

// Streams the run as JSON-lines: {type:"stage"|"review"|"foil"|"done"|"error", ...}
export async function POST(req: NextRequest) {
  const { projectId } = (await req.json()) as { projectId: string };
  if (!projectId) return Response.json({ error: "projectId required" }, { status: 400 });
  const project = await getProject(projectId);
  if (!project) return Response.json({ error: "unknown project" }, { status: 404 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await runBuild(project, emit);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : "build failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
