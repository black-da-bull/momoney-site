import { createNullTechnicalUst } from "./topology";
import type { Contradiction, MutationEvent, ProjectPhase, USTAtom } from "./types";

export interface ProjectSnapshot {
  projectId: string;
  schemaVersion: string;
  sequence: number;
  phase: ProjectPhase;
  technicalUst: USTAtom[];
  contradictions: Contradiction[];
  eventIds: string[];
  stateVersion: number;
  definitiveLockHash: string | null;
}

export interface AuthorityPolicy {
  canAccept(event: MutationEvent): boolean;
  canLock(event: MutationEvent): boolean;
  canReopen(event: MutationEvent): boolean;
}

export const SAFE_DEFAULT_AUTHORITY_POLICY: AuthorityPolicy = {
  canAccept: (event) => event.actorType === "HUMAN" && event.authority === "ROOT",
  // Lock authority is intentionally unresolved in replay. The default fails closed.
  // A runtime profile must inject the replay-backed actor policy before definitive lock.
  canLock: () => false,
  canReopen: (event) => event.actorType === "HUMAN" && event.authority === "ROOT",
};

export function newProjectSnapshot(projectId: string, schemaVersion: string): ProjectSnapshot {
  return {
    projectId,
    schemaVersion,
    sequence: 0,
    phase: "INTAKE",
    technicalUst: createNullTechnicalUst(),
    contradictions: [],
    eventIds: [],
    stateVersion: 0,
    definitiveLockHash: null,
  };
}

function atomFor(snapshot: ProjectSnapshot, address: string): USTAtom {
  const atom = snapshot.technicalUst.find((candidate) => candidate.address === address);
  if (!atom) throw new Error(`unknown Technical UST address: ${address}`);
  return atom;
}

function mergeEvidence(existing: string[], incoming: string[]): string[] {
  return Array.from(new Set(existing.concat(incoming)));
}

function assertEnvelope(snapshot: ProjectSnapshot, event: MutationEvent) {
  if (event.projectId !== snapshot.projectId) throw new Error("event project mismatch");
  if (event.expectedStateVersion !== snapshot.stateVersion) {
    throw new Error(`state version mismatch: expected ${event.expectedStateVersion}, actual ${snapshot.stateVersion}`);
  }
  if (snapshot.eventIds.includes(event.eventId)) throw new Error(`duplicate event id: ${event.eventId}`);
  if (event.sequence !== snapshot.sequence + 1) throw new Error(`event sequence must be ${snapshot.sequence + 1}`);
}

export function applyMutation(
  snapshot: ProjectSnapshot,
  event: MutationEvent,
  authority: AuthorityPolicy = SAFE_DEFAULT_AUTHORITY_POLICY,
): ProjectSnapshot {
  assertEnvelope(snapshot, event);
  const next: ProjectSnapshot = structuredClone(snapshot);

  if (event.command === "PROPOSE") {
    if (event.actorType === "SYSTEM") throw new Error("controller/system may not author semantic proposals");
    const atom = atomFor(next, event.targetAddress);
    if (atom.state === "LOCKED") throw new Error("locked address requires lawful reopen before proposal");
    atom.value = event.proposedValue;
    atom.state = "PROPOSED";
    atom.resolution = event.proposedValue == null ? "DEFERRED" : "VALUE";
    atom.evidenceRefs = mergeEvidence(atom.evidenceRefs, event.evidenceRefs);
    atom.revision += 1;
  } else if (event.command === "PRESSURE") {
    const atom = atomFor(next, event.targetAddress);
    if (atom.state !== "PROPOSED" && atom.state !== "PRESSURED") {
      throw new Error(`pressure requires PROPOSED/PRESSURED state, got ${atom.state}`);
    }
    atom.state = "PRESSURED";
    atom.evidenceRefs = mergeEvidence(atom.evidenceRefs, event.evidenceRefs);
    atom.revision += 1;
  } else if (event.command === "ACCEPT" || event.command === "RESOLVE") {
    if (!authority.canAccept(event)) throw new Error("actor is not authorized to accept/resolve semantic state");
    const atom = atomFor(next, event.targetAddress);
    if (!["PROPOSED", "PRESSURED"].includes(atom.state)) throw new Error(`cannot resolve atom from ${atom.state}`);
    atom.value = event.proposedValue;
    atom.state = "RESOLVED";
    atom.resolution = event.proposedValue == null ? "EXPLICIT_NONE" : "VALUE";
    atom.evidenceRefs = mergeEvidence(atom.evidenceRefs, event.evidenceRefs);
    atom.revision += 1;
  } else if (event.command === "LOCK") {
    if (!authority.canLock(event)) throw new Error("definitive-lock authority is unresolved or actor is unauthorized");
    if (next.phase !== "LOCK_ELIGIBLE") throw new Error(`definitive lock requires LOCK_ELIGIBLE phase, got ${next.phase}`);
    const unresolved = next.technicalUst.filter((atom) => atom.state !== "RESOLVED" && atom.state !== "LOCKED");
    if (unresolved.length) throw new Error(`definitive lock blocked by ${unresolved.length} unresolved addresses`);
    for (const atom of next.technicalUst) atom.state = "LOCKED";
    next.phase = "DEFINITIVE_LOCK";
    next.definitiveLockHash = event.payloadSha256;
  } else if (event.command === "REOPEN") {
    if (!authority.canReopen(event)) throw new Error("actor is not authorized to reopen locked state");
    const atom = atomFor(next, event.targetAddress);
    if (atom.state !== "LOCKED") throw new Error("reopen requires LOCKED atom");
    atom.state = "RESOLVED";
    atom.lockedSha256 = null;
    atom.revision += 1;
    next.definitiveLockHash = null;
    next.phase = "AXIS_FILL";
  }

  next.sequence = event.sequence;
  next.stateVersion += 1;
  next.eventIds.push(event.eventId);
  return next;
}

export function advancePhase(snapshot: ProjectSnapshot, phase: ProjectPhase): ProjectSnapshot {
  const order: ProjectPhase[] = [
    "INTAKE", "AXIS_FILL", "DRAFT_FREEZE", "ROUND_ROBIN", "RED_PEN", "LOCK_ELIGIBLE",
    "DEFINITIVE_LOCK", "FOIL", "SURFACE_BUILD", "SURFACE_FREEZE", "PACKAGE",
  ];
  const current = order.indexOf(snapshot.phase);
  const target = order.indexOf(phase);
  if (target !== current + 1) throw new Error(`illegal phase transition ${snapshot.phase} -> ${phase}`);
  if (phase === "DRAFT_FREEZE") {
    const undispositioned = snapshot.technicalUst.filter((atom) => atom.state === "NULL");
    if (undispositioned.length) throw new Error(`draft freeze blocked by ${undispositioned.length} NULL addresses`);
  }
  if (phase === "LOCK_ELIGIBLE") {
    const unready = snapshot.technicalUst.filter((atom) => atom.state !== "RESOLVED" && atom.state !== "LOCKED");
    if (unready.length) throw new Error(`lock eligibility blocked by ${unready.length} unresolved addresses`);
    if (snapshot.contradictions.some((item) => item.status === "OPEN")) throw new Error("lock eligibility blocked by open contradictions");
  }
  const next = structuredClone(snapshot);
  next.phase = phase;
  next.stateVersion += 1;
  return next;
}
