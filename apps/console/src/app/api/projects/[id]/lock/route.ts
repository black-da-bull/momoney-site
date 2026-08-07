import { NextRequest } from "next/server";
import { getProject } from "@/lib/store";
import { operatorLockAndDerive } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Explicit operator action is the only path that creates the definitive Technical UST lock.
// Only after that lock exists may the runtime run FOIL and derivative drafting.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { runId } = (await req.json().catch(() => ({}))) as { runId?: string };
  if (!runId) return Response.json({ error: "runId required" }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OPENAI_API_KEY is not set for this Vercel environment." }, { status: 503 });
  }

  const project = await getProject(params.id);
  if (!project) return Response.json({ error: "unknown project" }, { status: 404 });
  const run = project.runs.find((candidate) => candidate.id === runId);
  if (!run) return Response.json({ error: "unknown run" }, { status: 404 });

  try {
    await operatorLockAndDerive(project, run);
    return Response.json({
      ok: true,
      runId: run.id,
      phase: run.phase,
      definitiveLockHash: run.definitiveLockHash,
      packageHash: run.hash,
      triad: run.triad,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "operator lock failed" },
      { status: 409 },
    );
  }
}
