export const MAESTRO_SCHEMA_VERSION = "0.2.0" as const;

export type AxisId = "THY" | "VOC" | "STY" | "TIM" | "PER" | "POST" | "LYR";

export type AtomState = "NULL" | "PROPOSED" | "PRESSURED" | "RESOLVED" | "LOCKED";

export type ResolutionState = "VALUE" | "EXPLICIT_NONE" | "DEFERRED" | null;

export type ProjectPhase =
  | "INTAKE"
  | "AXIS_FILL"
  | "DRAFT_FREEZE"
  | "ROUND_ROBIN"
  | "RED_PEN"
  | "LOCK_ELIGIBLE"
  | "DEFINITIVE_LOCK"
  | "FOIL"
  | "SURFACE_BUILD"
  | "SURFACE_FREEZE"
  | "PACKAGE";

export interface USTAtom {
  address: string;
  axis: AxisId;
  keyId: string;
  keyName: string;
  subkeyId: string;
  subkeyName: string;
  value: unknown | null;
  state: AtomState;
  resolution: ResolutionState;
  ownerId: string | null;
  reviewerIds: string[];
  evidenceRefs: string[];
  dependencyAddresses: string[];
  contradictionIds: string[];
  revision: number;
  lockedSha256: string | null;
}

export type ActorType = "HUMAN" | "EMPLOYEE" | "SYSTEM";
export type Authority = "ROOT" | "ACCEPTED" | "PROPOSAL" | "INFERRED" | "HISTORICAL";
export type MutationCommand =
  | "LOAD"
  | "PROPOSE"
  | "PRESSURE"
  | "ACCEPT"
  | "REJECT"
  | "RESOLVE"
  | "LOCK"
  | "REOPEN"
  | "COMPILE"
  | "FREEZE"
  | "PACKAGE";

export interface MutationEvent {
  eventId: string;
  projectId: string;
  sequence: number;
  command: MutationCommand;
  actorId: string;
  actorType: ActorType;
  authority: Authority;
  targetAddress: string;
  expectedStateVersion: number;
  proposedValue: unknown;
  evidenceRefs: string[];
  reason: string;
  createdAt: string;
  idempotencyKey: string;
  payloadSha256: string;
}

export interface Contradiction {
  id: string;
  addresses: string[];
  claimA: string;
  claimB: string;
  openedBy: string;
  status: "OPEN" | "RESOLVED" | "CARRIED";
  resolution: string | null;
}

export interface SemDelta {
  criterionId: string;
  score: number | null;
  evidenceRefs: string[];
  affectedAddresses: string[];
  finding: string;
  severity: "Observe" | "Warn" | "Challenge" | "Block";
}

export interface EmployeeTurnResult {
  employeeId: string;
  targetAddresses: string[];
  proposedEvents: MutationEvent[];
  semDeltas: SemDelta[];
  contradictions: Contradiction[];
  rationale: string;
  downstreamImpact: string[];
}

export interface RuntimeInvariantResult {
  id: string;
  pass: boolean;
  detail: string;
}
