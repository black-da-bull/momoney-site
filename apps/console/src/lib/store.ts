// Deployment-safe project memory for the Maestro core runtime.
// Preview/production: Prisma Postgres when a supported database URL is present.
// Local development fallback: JSON files under .data/projects.

import { promises as fs } from "fs";
import path from "path";
import type { Prisma } from "@prisma/client";
import { ensureMaestroSchema, hasDatabase, prisma } from "./prisma";
import { Slot, emptyGrid, verifyCoreTopology } from "./ust";

export interface ChatMessage { role: "artist" | "maestro"; text: string; at: string }
export interface ChangeEntry { seq: number; at: string; address: string; from: string | null; to: string | null; status: string; provenance: string; note: string }
export interface ContradictionRecord { id: string; addresses: string[]; issue: string; conflictType: "cross_axis" | "ownership" | "feasibility" | "excellence" | "continuity" | "authorship" | "downstream_projection"; materiality: "non_blocking" | "blocking"; openedBy: string; openedAt: string; resolutionState: "open" | "resolved" | "carried_explicitly" | "operator_decision_required"; resolution: string | null; closedBy: string | null; closedAt: string | null }
export interface DissentRecord { id: string; employeeId: string; addresses: string[]; objection: string; domainBasis: string; predictedFailure: string; severity: "advisory" | "material" | "blocking"; disposition: "open" | "accepted" | "answered" | "overruled_by_operator" | "carried_with_risk" | "unresolved"; impactAcknowledged: boolean; at: string }
export interface GateResult { id: string; gateType: "SEM" | "SEG" | "G_CARD" | "SE20"; evaluatedAddresses: string[]; evidenceRefs: string[]; findings: string[]; blockers: string[]; requiredActions: string[]; verdict: "pass" | "conditional" | "hold" | "fail"; rerouteTarget: string | null; at: string }
export interface RunStage { name: string; status: "running" | "done" | "skipped" | "failed"; note: string }
export interface ReviewNote { who: string; note: string; severity: "observe" | "warn" | "challenge" }
export interface Triad { creativeUst: string; showSummary: string; personaProfile: string; personaStyleLine: string }
export interface BuildRun { id: string; at: string; stages: RunStage[]; reviewNotes: ReviewNote[]; defended: { address: string; why: string }[]; contradictionIds: string[]; dissentIds: string[]; gateResultIds: string[]; foil: { promoteShow: string[]; promotePersona: string[] } | null; triad: Triad | null; draftFreezeHash: string | null; definitiveLockHash: string | null; hash: string | null; accepted: boolean }
export interface Project { id: string; title: string; createdAt: string; seedRaw: string | null; grid: Slot[]; messages: ChatMessage[]; changeLog: ChangeEntry[]; contradictions: ContradictionRecord[]; dissent: DissentRecord[]; gates: GateResult[]; runs: BuildRun[] }

const DATA_DIR = path.join(process.cwd(), ".data", "projects");

async function ensureDir() { await fs.mkdir(DATA_DIR, { recursive: true }); }
function projectPath(id: string) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("bad project id");
  return path.join(DATA_DIR, `${id}.json`);
}

function normalizeProject(project: Project): Project {
  project.messages ??= [];
  project.changeLog ??= [];
  project.contradictions ??= [];
  project.dissent ??= [];
  project.gates ??= [];
  project.runs ??= [];
  const topology = verifyCoreTopology(project.grid ?? []);
  if (!topology.ok) {
    const replacement = emptyGrid();
    for (const oldSlot of project.grid ?? []) {
      const exact = replacement.find((slot) => slot.address === oldSlot.address);
      if (exact) Object.assign(exact, oldSlot);
    }
    project.grid = replacement;
    appendChange(project, { address: "*", from: null, to: "200-address core topology", status: "MIGRATED", provenance: "runtime-contract-v0.1", note: `topology normalized: ${topology.errors.join("; ")}` });
  }
  for (const run of project.runs) {
    run.contradictionIds ??= [];
    run.dissentIds ??= [];
    run.gateResultIds ??= [];
    run.draftFreezeHash ??= run.hash ?? null;
    run.definitiveLockHash ??= run.accepted ? run.hash ?? null : null;
  }
  return project;
}

async function dbExists(id: string) {
  await ensureMaestroSchema();
  return Boolean(await prisma.maestroProject.findUnique({ where: { id }, select: { id: true } }));
}
async function fileExists(id: string) {
  try { await fs.access(projectPath(id)); return true; } catch { return false; }
}

export async function listProjects(): Promise<Pick<Project, "id" | "title" | "createdAt">[]> {
  if (hasDatabase()) {
    await ensureMaestroSchema();
    const rows = await prisma.maestroProject.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, title: true, createdAt: true } });
    return rows.map((row) => ({ id: row.id, title: row.title, createdAt: row.createdAt.toISOString() }));
  }
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const out: Pick<Project, "id" | "title" | "createdAt">[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const project = normalizeProject(JSON.parse(await fs.readFile(path.join(DATA_DIR, file), "utf8")) as Project);
      out.push({ id: project.id, title: project.title, createdAt: project.createdAt });
    } catch { /* preserve unreadable files */ }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createProject(title: string): Promise<Project> {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "untitled";
  let id = base;
  let counter = 1;
  while (hasDatabase() ? await dbExists(id) : await fileExists(id)) id = `${base}-${++counter}`;
  const project: Project = { id, title, createdAt: new Date().toISOString(), seedRaw: null, grid: emptyGrid(), messages: [], changeLog: [], contradictions: [], dissent: [], gates: [], runs: [] };
  await save(project);
  return project;
}

export async function getProject(id: string): Promise<Project | null> {
  if (hasDatabase()) {
    await ensureMaestroSchema();
    const row = await prisma.maestroProject.findUnique({ where: { id } });
    return row ? normalizeProject(row.payload as unknown as Project) : null;
  }
  await ensureDir();
  try { return normalizeProject(JSON.parse(await fs.readFile(projectPath(id), "utf8")) as Project); }
  catch { return null; }
}

export async function save(project: Project): Promise<void> {
  const normalized = normalizeProject(project);
  if (hasDatabase()) {
    await ensureMaestroSchema();
    await prisma.maestroProject.upsert({
      where: { id: normalized.id },
      create: { id: normalized.id, title: normalized.title, createdAt: new Date(normalized.createdAt), payload: normalized as unknown as Prisma.InputJsonValue },
      update: { title: normalized.title, payload: normalized as unknown as Prisma.InputJsonValue },
    });
    return;
  }
  await ensureDir();
  const tmp = projectPath(normalized.id) + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(normalized, null, 2), "utf8");
  await fs.rename(tmp, projectPath(normalized.id));
}

export function appendChange(project: Project, entry: Omit<ChangeEntry, "seq" | "at">): void {
  project.changeLog.push({ seq: project.changeLog.length + 1, at: new Date().toISOString(), ...entry });
}
