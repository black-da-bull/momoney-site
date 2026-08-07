import { NextRequest } from "next/server";
import { getDbProject, listDbDialogue, listRuns } from "@/lib/maestro/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await getDbProject(params.id);
  if (!project) return Response.json({ error: "unknown project" }, { status: 404 });
  const dialogue = await listDbDialogue(params.id);
  const runs = await listRuns(params.id);
  return Response.json({
    id: project.id,
    title: project.title,
    createdAt: project.createdAt,
    seedRaw: project.seedRaw,
    phase: project.phase,
    definitiveLockHash: project.definitiveLockHash,
    surfaces: project.surfaces,
    messages: dialogue.map((d) => ({
      role: d.speakerType === "HUMAN" ? "artist" : "maestro",
      text: d.speakerType === "EMPLOYEE" ? `${d.speakerId}: ${d.text}` : d.text,
      at: d.createdAt,
      kind: d.kind,
      speakerId: d.speakerId,
      targetAddresses: d.targetAddresses,
    })),
    grid: project.snapshot.technicalUst.map((a: any) => ({
      address: a.address,
      axis: a.axis,
      key: `${a.keyName} · ${a.subkeyName}`,
      value: a.value == null ? null : typeof a.value === "string" ? a.value : JSON.stringify(a.value),
      status: a.state,
      provenance: a.ownerId ? `owner:${a.ownerId}` : "",
    })),
    changeLog: project.snapshot.eventIds ?? [],
    runs: runs.map((run) => ({
      id: run.id,
      triad: run.surfaces ?? null,
      reviewNotes: (run.transcript ?? []).flatMap((r: any) => (r.turns ?? []).flatMap((t: any) => (t.challenges ?? []).map((c: any) => ({ who: "pressure-room", note: `${c.address}: ${c.issue}`, severity: c.severity })))),
      defended: [],
      accepted: run.status === "COMPLETE",
      hash: project.definitiveLockHash,
      status: run.status,
      semState: run.semState,
      redPen: run.redPen,
    })),
  });
}
