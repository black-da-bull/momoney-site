import { NextRequest } from "next/server";
import { getProject, save, appendChange } from "@/lib/store";

export const runtime = "nodejs";

// The artist's explicit accept-&-lock — the only path to LOCKED (soul: root=human).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { runId } = (await req.json().catch(() => ({}))) as { runId?: string };
  const project = await getProject(params.id);
  if (!project) return Response.json({ error: "unknown project" }, { status: 404 });

  const run = runId ? project.runs.find((r) => r.id === runId) : project.runs[project.runs.length - 1];
  if (!run?.triad) return Response.json({ error: "no packaged run to accept" }, { status: 400 });

  let locked = 0;
  for (const slot of project.grid) {
    if (slot.value != null && slot.status !== "LOCKED") {
      const from = slot.status;
      slot.status = "LOCKED";
      slot.updatedAt = new Date().toISOString();
      appendChange(project, {
        address: slot.address,
        from: slot.value,
        to: slot.value,
        status: "LOCKED",
        provenance: "artist accept-&-lock",
        note: `run ${run.id}: ${from} → LOCKED by artist`,
      });
      locked++;
    }
  }
  run.accepted = true;
  appendChange(project, {
    address: "*",
    from: null,
    to: `run ${run.id} accepted`,
    status: "LOCKED",
    provenance: "artist",
    note: `triad accepted · ${locked} addresses locked`,
  });
  await save(project);
  return Response.json({ ok: true, locked, runId: run.id });
}
