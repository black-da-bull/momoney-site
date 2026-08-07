import type { RuntimeInvariantResult } from "./types";

export interface SemCriterion {
  id: string;
  name: string;
  weight: number;
  minimum: number;
  genreConditioned?: boolean;
}

export const SEM_RELEASE_FLOOR = 97.5;

export const SEM_CRITERIA: readonly SemCriterion[] = [
  { id: "S1", name: "Hook_Strength", weight: 18, minimum: 4 },
  { id: "S2", name: "Lyric_Integrity_and_Emotional_Clarity", weight: 12, minimum: 3 },
  { id: "S3", name: "Vocal_Delivery_and_Character", weight: 10, minimum: 3 },
  { id: "S4", name: "Melody_and_Topline_Craft", weight: 10, minimum: 3 },
  { id: "S5", name: "Structure_and_Pacing", weight: 8, minimum: 3 },
  { id: "S6", name: "Production_Quality", weight: 12, minimum: 3 },
  { id: "S7", name: "Arrangement_Interest_and_Contrast", weight: 6, minimum: 2 },
  { id: "S8", name: "Commercial_Viability_and_Market_Fit", weight: 8, minimum: 3 },
  { id: "S9", name: "Originality_and_Distinctive_Element", weight: 6, minimum: 2 },
  { id: "S10", name: "Metadata_and_Governance", weight: 4, minimum: 3 },
  { id: "S11", name: "Lyric_Syllable_Integrity", weight: 4, minimum: 4, genreConditioned: true },
  { id: "S12", name: "PreRelease_QA_and_Lyric_Compliance", weight: 2, minimum: 2 },
] as const;

export type SemScores = Record<string, number>;

export function calculateSemComposite(scores: SemScores): number {
  return SEM_CRITERIA.reduce((total, criterion) => {
    const score = scores[criterion.id];
    if (typeof score !== "number" || score < 0 || score > 5) return total;
    return total + (score / 5) * criterion.weight;
  }, 0);
}

export function semCriterionFailures(scores: SemScores): string[] {
  return SEM_CRITERIA.filter((criterion) => {
    const score = scores[criterion.id];
    return typeof score !== "number" || score < criterion.minimum;
  }).map((criterion) => criterion.id);
}

export interface HardGateResult {
  id: string;
  status: "PASS" | "FAIL" | "UNRESOLVED";
  evidenceRefs: string[];
  affectedAddresses: string[];
  remediation: string | null;
}

// The gate registry is intentionally typed but not populated with invented rules.
// Gate definitions are loaded only when replay-backed criteria are available.
export type HardGateRegistry = Record<string, HardGateResult>;

export function validateSemRegistry(): RuntimeInvariantResult[] {
  const weightTotal = SEM_CRITERIA.reduce((sum, criterion) => sum + criterion.weight, 0);
  const uniqueIds = new Set(SEM_CRITERIA.map((criterion) => criterion.id));
  const validBands = SEM_CRITERIA.every((criterion) => criterion.minimum >= 0 && criterion.minimum <= 5);
  return [
    { id: "SEM.CRITERIA.12", pass: SEM_CRITERIA.length === 12, detail: `${SEM_CRITERIA.length} weighted criteria` },
    { id: "SEM.WEIGHTS.100", pass: weightTotal === 100, detail: `weights total ${weightTotal}` },
    { id: "SEM.IDS.UNIQUE", pass: uniqueIds.size === SEM_CRITERIA.length, detail: `${uniqueIds.size} unique criterion ids` },
    { id: "SEM.MINIMUMS.0_5", pass: validBands, detail: validBands ? "all minimums within 0..5" : "invalid criterion minimum" },
    { id: "SEM.RELEASE.97_5", pass: SEM_RELEASE_FLOOR === 97.5, detail: `release floor ${SEM_RELEASE_FLOOR}` },
  ];
}
