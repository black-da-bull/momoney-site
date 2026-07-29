// Project memory storage.
// Dev/default: JSON file store under .data/ (git-ignored).
// Prod: Vercel Postgres via packages/db (drizzle) — activation deferred until the
// database is provisioned; the interface below is what that implementation swaps into.

import { promises as fs } from "fs";
import path from "path";
import { Slot, emptyGrid } from "./ust";

export interface ChatMessage {
  role: "artist" | "maestro";
  text: string; // artist text stored verbatim — raw input is immutable
  at: string;
}

export interface ChangeEntry {
  seq: number;
  at: string;
  address: string;
  from: string | null;
  to: string | null;
  status: string;
  provenance: string;
  note: string;
}

export interface RunStage {
  name: string;
  status: "running" | "done" | "skipped" | "failed";
  note: string;
}

export interface ReviewNote {
  who: string;
  note: string; // verbatim — review notes are first-class artifacts, never smoothed
  severity: "observe" | "warn" | "challenge";
}

export interface Triad {
  creativeUst: string; // → Suno lyrics prompt
  showSummary: string; // → Suno style prompt
  personaProfile: string; // → Suno persona bio
  personaStyleLine: string; // → Suno persona style (≤150)
}

export interface BuildRun {
  id: string;
  at: string;
  stages: RunStage[];
  reviewNotes: ReviewNote[];
  defended: { address: string; why: string }[]; // justified-open → artist decisions
  foil: { promoteShow: string[]; promotePersona: string[] } | null;
  triad: Triad | null;
  hash: string | null; // internal derivation lock over the resolved grid
  accepted: boolean; // true only after the artist's explicit accept-&-lock
}

export interface Project {
  id: string;
  title: string;
  createdAt: string;
  seedRaw: string | null; // the artist's first input, verbatim, never edited
  grid: Slot[];
  messages: ChatMessage[];
  changeLog: ChangeEntry[]; // append-only
  runs: BuildRun[];
}

const DATA_DIR = path.join(process.cwd(), ".data", "projects");

function assertFileStore() {
  if (process.env.DATABASE_URL) {
    // Honest failure over silent divergence: the pg store is not wired yet.
    throw new Error(
      "DATABASE_URL is set but the Postgres store is not wired yet (deferred to the factory phase). Unset it to use the file store.",
    );
  }
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function projectPath(id: string) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error("bad project id");
  return path.join(DATA_DIR, `${id}.json`);
}

export async function listProjects(): Promise<Pick<Project, "id" | "title" | "createdAt">[]> {
  assertFileStore();
  await ensureDir();
  const files = await fs.readdir(DATA_DIR);
  const out: Pick<Project, "id" | "title" | "createdAt">[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const p = JSON.parse(await fs.readFile(path.join(DATA_DIR, f), "utf8")) as Project;
      out.push({ id: p.id, title: p.title, createdAt: p.createdAt });
    } catch {
      // unreadable file: skip, never delete
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createProject(title: string): Promise<Project> {
  assertFileStore();
  await ensureDir();
  const id =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "untitled";
  let unique = id;
  let n = 1;
  while (await exists(unique)) unique = `${id}-${++n}`;
  const project: Project = {
    id: unique,
    title,
    createdAt: new Date().toISOString(),
    seedRaw: null,
    grid: emptyGrid(),
    messages: [],
    changeLog: [],
    runs: [],
  };
  await save(project);
  return project;
}

async function exists(id: string): Promise<boolean> {
  try {
    await fs.access(projectPath(id));
    return true;
  } catch {
    return false;
  }
}

export async function getProject(id: string): Promise<Project | null> {
  assertFileStore();
  await ensureDir();
  try {
    const p = JSON.parse(await fs.readFile(projectPath(id), "utf8")) as Project;
    p.runs ??= []; // projects saved before the factory phase
    return p;
  } catch {
    return null;
  }
}

export async function save(project: Project): Promise<void> {
  assertFileStore();
  await ensureDir();
  const tmp = projectPath(project.id) + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(project, null, 2), "utf8");
  await fs.rename(tmp, projectPath(project.id));
}

export function appendChange(
  project: Project,
  entry: Omit<ChangeEntry, "seq" | "at">,
): void {
  project.changeLog.push({
    seq: project.changeLog.length + 1,
    at: new Date().toISOString(),
    ...entry,
  });
}
