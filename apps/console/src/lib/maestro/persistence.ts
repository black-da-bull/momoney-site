import type { MutationEvent, ProjectPhase } from "./types";
import type { ProjectSnapshot } from "./state";

export interface MaestroProjectRecord {
  id: string;
  title: string;
  schemaVersion: string;
  createdAt: string;
  seedRaw: string | null;
}

export interface PersistedMutationEvent extends MutationEvent {
  persistedAt: string;
}

export interface SnapshotCheckpoint {
  projectId: string;
  sequence: number;
  stateVersion: number;
  phase: ProjectPhase;
  payloadSha256: string;
  createdAt: string;
  snapshot: ProjectSnapshot;
}

export type DialogueKind =
  | "OPERATOR_INPUT"
  | "EMPLOYEE_UTTERANCE"
  | "CHALLENGE"
  | "REVISION"
  | "DEFENSE"
  | "CONTRADICTION"
  | "RED_PEN"
  | "DECISION"
  | "SYSTEM_NOTE";

export interface DialogueRecord {
  id: string;
  projectId: string;
  sequence: number;
  kind: DialogueKind;
  speakerId: string;
  speakerType: "HUMAN" | "EMPLOYEE" | "SYSTEM";
  text: string;
  targetAddresses: string[];
  evidenceRefs: string[];
  createdAt: string;
}

export interface AppendEventResult {
  event: PersistedMutationEvent;
  previousSequence: number;
  currentSequence: number;
}

/**
 * Durable Maestro persistence boundary.
 *
 * Canonical persistence law:
 * - Mutation events are append-only and authoritative for replay.
 * - Snapshots are checkpoints only; they may be discarded and reconstructed.
 * - Dialogue/pressure records are first-class evidence and never compressed into state.
 * - Project metadata is mutable only through explicit repository methods; seedRaw is immutable once set.
 */
export interface MaestroPersistence {
  createProject(record: MaestroProjectRecord, initialSnapshot: SnapshotCheckpoint): Promise<void>;
  getProject(projectId: string): Promise<MaestroProjectRecord | null>;
  listProjects(): Promise<MaestroProjectRecord[]>;

  appendEvent(event: PersistedMutationEvent): Promise<AppendEventResult>;
  listEvents(projectId: string, afterSequence?: number): Promise<PersistedMutationEvent[]>;

  saveCheckpoint(checkpoint: SnapshotCheckpoint): Promise<void>;
  loadLatestCheckpoint(projectId: string): Promise<SnapshotCheckpoint | null>;

  appendDialogue(record: DialogueRecord): Promise<void>;
  listDialogue(projectId: string, afterSequence?: number): Promise<DialogueRecord[]>;
}

export function validatePersistedEventOrder(events: PersistedMutationEvent[]): string[] {
  const failures: string[] = [];
  const seenIds = new Set<string>();
  const seenIdempotency = new Set<string>();

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const expected = index === 0 ? event.sequence : events[index - 1].sequence + 1;
    if (event.sequence !== expected) failures.push(`event ${event.eventId}: expected sequence ${expected}, got ${event.sequence}`);
    if (seenIds.has(event.eventId)) failures.push(`duplicate eventId ${event.eventId}`);
    if (seenIdempotency.has(event.idempotencyKey)) failures.push(`duplicate idempotencyKey ${event.idempotencyKey}`);
    seenIds.add(event.eventId);
    seenIdempotency.add(event.idempotencyKey);
  }

  return failures;
}

export function checkpointMatchesSnapshot(checkpoint: SnapshotCheckpoint): boolean {
  return (
    checkpoint.projectId === checkpoint.snapshot.projectId &&
    checkpoint.sequence === checkpoint.snapshot.sequence &&
    checkpoint.stateVersion === checkpoint.snapshot.stateVersion &&
    checkpoint.phase === checkpoint.snapshot.phase
  );
}
