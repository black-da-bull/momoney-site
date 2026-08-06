import { NextRequest } from "next/server";
import { getProject, save, appendChange } from "@/lib/store";
import { coreGrid } from "@/lib/ust";

export const runtime = "nodejs";

// Artist acceptance promotes a packaged proposal. It cannot manufacture the
// definitive Technical UST lock; that lock must already exist before FOIL.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { runId } = (await req.json().catch(() => ({}))) as { runId?: string };
  const project = await getProject(params.id);
  if (!project) return Response.json({ error: "unknown project" }, { status: 404 });

  const run = runId ? project.runs.find((candidate) => candidate.id === runId) : project.runs[project.runs.length - 1];
  if (!run?.triad) return Response.json({ error: "no packaged run to accept" }, { status: 400 });
  if (!run.definitiveLockHash) return Response.json({ error: "definitive Technical UST lock missing" }, { status: 409 });

  const runGates = project.gates.filter((gate) => run.gateResultIds.includes(gate.id));
  const failed = runGates.filter((gate) => gate.verdict === "fail" || gate.verdict === "hold");
  if (failed.length) {
    return Response.json({ error: "acceptance blocked by gate results", gates: failed.map((gate) => gate.id) }, { status: 409 });
  }

  const unresolvedBlocking = project.contradictions.filter(
    (record) => run.contradictionIds.includes(record.id) && record.materiality === "blocking" && record.resolutionState === "open",
  );
  if (unresolvedBlocking.length) {
    return Response.json({ error: "acceptance blocked by unresolved contradictions", contradictions: unresolvedBlocking.map((record) => record.id) }, { status: 409 });
  }

  let promoted = 0;
  for (const slot of coreGrid(project.grid)) {
    if (slot.lockState !== "DEFINITIVE_LOCKED") {
      return Response.json({ error: `address ${slot.address} is not definitively locked` }, { status: 409 });
    }
    if (slot.status !== "LOCKED") {
      const from = slot.status;
      slot.status = "LOCKED";
      slot.updatedAt = new Date().toISOString();
      appendChange(project, {
        address: slot.address,
        from: slot.value,
        to: slot.value,
        status: "LOCKED",
        provenance: "artist accept-&-lock",
        note: `run ${run.id}: ${from} → LOCKED by artist; parent ${run.definitiveLockHash}`,
      });
      promoted++;
    }
  }

  run.accepted = true;
  appendChange(project, {
    address: "*",
    from: null,
    to: `run ${run.id} accepted`,
    status: "LOCKED",
    provenance: "artist",
    note: `triad accepted · ${promoted} canonical addresses promoted · definitive lock ${run.definitiveLockHash}`,
  });
  await save(project);
  return Response.json({ ok: true, locked: promoted, runId: run.id, definitiveLockHash: run.definitiveLockHash });
}
