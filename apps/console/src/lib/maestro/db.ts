import { Pool } from "pg";
import type { DialogueRecord, MaestroProjectRecord } from "./persistence";

const databaseUrl =
  process.env.DATABASE_URL ??
  process.env.PRISMA_DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.storage_DATABASE_URL ??
  process.env.storage_PRISMA_DATABASE_URL ??
  process.env.storage_POSTGRES_URL ??
  null;

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function hasMaestroDatabase(): boolean {
  return Boolean(databaseUrl);
}

export function db(): Pool {
  if (!databaseUrl) throw new Error("No Maestro database URL is configured for this deployment.");
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      max: 4,
      ssl: databaseUrl.includes("localhost") ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function ensureMaestroSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const client = await db().connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        CREATE TABLE IF NOT EXISTS maestro_v02_projects (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          schema_version TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          seed_raw TEXT,
          phase TEXT NOT NULL DEFAULT 'INTAKE',
          current_snapshot JSONB NOT NULL,
          definitive_lock_hash TEXT,
          surfaces JSONB,
          packaged_at TIMESTAMPTZ
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS maestro_v02_events (
          project_id TEXT NOT NULL REFERENCES maestro_v02_projects(id) ON DELETE CASCADE,
          sequence INTEGER NOT NULL,
          event_id TEXT NOT NULL UNIQUE,
          idempotency_key TEXT NOT NULL UNIQUE,
          payload JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY(project_id, sequence)
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS maestro_v02_dialogue (
          project_id TEXT NOT NULL REFERENCES maestro_v02_projects(id) ON DELETE CASCADE,
          sequence INTEGER NOT NULL,
          id TEXT NOT NULL UNIQUE,
          kind TEXT NOT NULL,
          speaker_id TEXT NOT NULL,
          speaker_type TEXT NOT NULL,
          text TEXT NOT NULL,
          target_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
          evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY(project_id, sequence)
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS maestro_v02_runs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL REFERENCES maestro_v02_projects(id) ON DELETE CASCADE,
          status TEXT NOT NULL,
          started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          completed_at TIMESTAMPTZ,
          transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
          sem_state JSONB NOT NULL DEFAULT '{}'::jsonb,
          red_pen JSONB,
          foil JSONB,
          surfaces JSONB,
          error TEXT
        )
      `);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      schemaReady = null;
      throw error;
    } finally {
      client.release();
    }
  })();
  return schemaReady;
}

export async function createDbProject(record: MaestroProjectRecord, snapshot: unknown): Promise<void> {
  await ensureMaestroSchema();
  await db().query(
    `INSERT INTO maestro_v02_projects(id,title,schema_version,created_at,seed_raw,phase,current_snapshot)
     VALUES($1,$2,$3,$4,$5,'INTAKE',$6::jsonb)`,
    [record.id, record.title, record.schemaVersion, record.createdAt, record.seedRaw, JSON.stringify(snapshot)],
  );
}

export async function listDbProjects(): Promise<Array<MaestroProjectRecord & { phase: string }>> {
  await ensureMaestroSchema();
  const result = await db().query(
    `SELECT id,title,schema_version,created_at,seed_raw,phase
     FROM maestro_v02_projects ORDER BY created_at DESC`,
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    schemaVersion: row.schema_version,
    createdAt: new Date(row.created_at).toISOString(),
    seedRaw: row.seed_raw,
    phase: row.phase,
  }));
}

export async function getDbProject(projectId: string): Promise<any | null> {
  await ensureMaestroSchema();
  const result = await db().query(`SELECT * FROM maestro_v02_projects WHERE id=$1`, [projectId]);
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    title: row.title,
    schemaVersion: row.schema_version,
    createdAt: new Date(row.created_at).toISOString(),
    seedRaw: row.seed_raw,
    phase: row.phase,
    snapshot: row.current_snapshot,
    definitiveLockHash: row.definitive_lock_hash,
    surfaces: row.surfaces,
    packagedAt: row.packaged_at ? new Date(row.packaged_at).toISOString() : null,
  };
}

export async function updateDbProject(projectId: string, patch: {
  seedRaw?: string | null;
  phase?: string;
  snapshot?: unknown;
  definitiveLockHash?: string | null;
  surfaces?: unknown;
  packagedAt?: string | null;
}): Promise<void> {
  await ensureMaestroSchema();
  const current = await getDbProject(projectId);
  if (!current) throw new Error("unknown project");
  await db().query(
    `UPDATE maestro_v02_projects
     SET seed_raw=$2, phase=$3, current_snapshot=$4::jsonb, definitive_lock_hash=$5,
         surfaces=$6::jsonb, packaged_at=$7
     WHERE id=$1`,
    [
      projectId,
      patch.seedRaw !== undefined ? patch.seedRaw : current.seedRaw,
      patch.phase ?? current.phase,
      JSON.stringify(patch.snapshot ?? current.snapshot),
      patch.definitiveLockHash !== undefined ? patch.definitiveLockHash : current.definitiveLockHash,
      JSON.stringify(patch.surfaces !== undefined ? patch.surfaces : current.surfaces),
      patch.packagedAt !== undefined ? patch.packagedAt : current.packagedAt,
    ],
  );
}

export async function appendDbDialogue(record: DialogueRecord): Promise<void> {
  await ensureMaestroSchema();
  await db().query(
    `INSERT INTO maestro_v02_dialogue(project_id,sequence,id,kind,speaker_id,speaker_type,text,target_addresses,evidence_refs,created_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)`,
    [record.projectId, record.sequence, record.id, record.kind, record.speakerId, record.speakerType, record.text,
      JSON.stringify(record.targetAddresses), JSON.stringify(record.evidenceRefs), record.createdAt],
  );
}

export async function listDbDialogue(projectId: string): Promise<DialogueRecord[]> {
  await ensureMaestroSchema();
  const result = await db().query(`SELECT * FROM maestro_v02_dialogue WHERE project_id=$1 ORDER BY sequence`, [projectId]);
  return result.rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    sequence: row.sequence,
    kind: row.kind,
    speakerId: row.speaker_id,
    speakerType: row.speaker_type,
    text: row.text,
    targetAddresses: row.target_addresses ?? [],
    evidenceRefs: row.evidence_refs ?? [],
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function nextDialogueSequence(projectId: string): Promise<number> {
  await ensureMaestroSchema();
  const result = await db().query(`SELECT COALESCE(MAX(sequence),0)+1 AS next FROM maestro_v02_dialogue WHERE project_id=$1`, [projectId]);
  return Number(result.rows[0].next);
}

export async function createRun(projectId: string): Promise<string> {
  await ensureMaestroSchema();
  const id = `run-${Date.now().toString(36)}`;
  await db().query(`INSERT INTO maestro_v02_runs(id,project_id,status) VALUES($1,$2,'RUNNING')`, [id, projectId]);
  return id;
}

export async function updateRun(runId: string, patch: Record<string, unknown>): Promise<void> {
  await ensureMaestroSchema();
  const currentResult = await db().query(`SELECT * FROM maestro_v02_runs WHERE id=$1`, [runId]);
  if (!currentResult.rowCount) throw new Error("unknown run");
  const row = currentResult.rows[0];
  await db().query(
    `UPDATE maestro_v02_runs SET status=$2, completed_at=$3, transcript=$4::jsonb, sem_state=$5::jsonb,
      red_pen=$6::jsonb, foil=$7::jsonb, surfaces=$8::jsonb, error=$9 WHERE id=$1`,
    [runId,
      patch.status ?? row.status,
      patch.completedAt ?? row.completed_at,
      JSON.stringify(patch.transcript ?? row.transcript),
      JSON.stringify(patch.semState ?? row.sem_state),
      JSON.stringify(patch.redPen ?? row.red_pen),
      JSON.stringify(patch.foil ?? row.foil),
      JSON.stringify(patch.surfaces ?? row.surfaces),
      patch.error ?? row.error],
  );
}

export async function listRuns(projectId: string): Promise<any[]> {
  await ensureMaestroSchema();
  const result = await db().query(`SELECT * FROM maestro_v02_runs WHERE project_id=$1 ORDER BY started_at`, [projectId]);
  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    startedAt: new Date(row.started_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    transcript: row.transcript ?? [],
    semState: row.sem_state ?? {},
    redPen: row.red_pen,
    foil: row.foil,
    surfaces: row.surfaces,
    error: row.error,
  }));
}
