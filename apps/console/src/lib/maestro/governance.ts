import type { SemDelta } from "./types";

export type GateStatus = "PASS" | "WARN" | "FAIL" | "UNRESOLVED" | "N_A";

export interface SegReport {
  reportId: string;
  snapshotRef: string;
  semDeltas: SemDelta[];
  hardGates: Array<{
    gateId: string;
    status: GateStatus;
    evidenceRefs: string[];
    affectedAddresses: string[];
    remediation: string | null;
  }>;
  gCardRef: string | null;
  se20Ref: string | null;
  hpaRef: string | null;
  redPenItems: RedPenItem[];
}

export const G_CARD_DIMENSIONS = [
  "Coherence",
  "Sonic_Architecture",
  "Performance_Authenticity",
  "Cultural_and_Genre_Integrity",
  "Strategic_Value",
  "Scoring_Mechanics",
  "External_Viability",
  "Visual_Coherence",
] as const;

export type GCardDimension = (typeof G_CARD_DIMENSIONS)[number];

export interface GCardEvidence {
  dimension: GCardDimension;
  status: GateStatus;
  evidenceRefs: string[];
  affectedAddresses: string[];
  finding: string;
}

export interface GCard {
  id: string;
  snapshotRef: string;
  dimensions: GCardEvidence[];
  // Historical >=7 scoring is not promoted as the current release threshold.
  historicalScore: number | null;
  currentDecision: "CLEAR" | "RED_PEN" | "UNRESOLVED";
}

export interface Se20Report {
  id: string;
  snapshotRef: string;
  // Exact current relation to older BICDM-20/SEM strata remains unresolved.
  status: "UNRESOLVED_SCHEMA" | "EVIDENCE_BOUND";
  items: Array<{
    itemId: string;
    status: "PASS" | "WARN" | "N_A";
    evidenceRefs: string[];
    affectedAddresses: string[];
  }>;
}

export interface HpaReport {
  id: string;
  creativeAuthenticity: number | null;
  emotionalImpact: number | null;
  sonicFidelityToIntent: number | null;
  viralPotentialPerception: number | null;
  // Aggregate formula is intentionally absent until replay-backed.
  aggregate: null;
}

export interface RedPenItem {
  id: string;
  affectedAddresses: string[];
  issue: string;
  ownerId: string | null;
  evidenceRefs: string[];
  disposition: "OPEN" | "REVISED" | "CARRIED" | "CLEARED";
}

export const UNRESOLVED_GOVERNANCE = {
  q1q16: "No recovered primary rubric; reserve namespace and do not fabricate.",
  redPenSeverityTiers: "Unresolved.",
  redPenIterationCap: "Unresolved.",
  se20Relationship: "Distinct check/output is accepted; exact relationship remains unresolved.",
  hpaAggregate: "Individual dimensions recovered; aggregate formula unresolved.",
} as const;
