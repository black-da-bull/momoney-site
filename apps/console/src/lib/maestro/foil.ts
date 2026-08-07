export type CoverageStatus = "RENDERED" | "INTERNAL_ONLY" | "PROFILE_EXCLUDED";

export interface CoverageDisposition {
  address: string;
  status: CoverageStatus;
  targetSurfaces: string[];
  transformId: string;
  outputSha256: string | null;
  rationale: string;
}

export interface FoilResult {
  sourceLockHash: string;
  promotedTraits: Array<{
    sourceAddresses: string[];
    targetOwner: string;
    trait: string;
    evidenceRefs: string[];
  }>;
  repeatNotationCandidates: Array<{
    sourceAddresses: string[];
    notation: string;
  }>;
  coverage: CoverageDisposition[];
}

export function validateFoilCoverage(lockedAddresses: string[], result: FoilResult): string[] {
  const errors: string[] = [];
  const byAddress = new Map(result.coverage.map((item) => [item.address, item]));
  for (const address of lockedAddresses) {
    if (!byAddress.has(address)) errors.push(`missing coverage disposition: ${address}`);
  }
  for (const item of result.coverage) {
    if (!lockedAddresses.includes(item.address)) errors.push(`coverage references non-locked address: ${item.address}`);
    if (item.status === "RENDERED" && item.targetSurfaces.length === 0) errors.push(`rendered address has no target surface: ${item.address}`);
    if (!item.rationale.trim()) errors.push(`coverage disposition has no rationale: ${item.address}`);
  }
  return errors;
}

// The forward-cascade/reverse-promotion algorithm is deliberately not implemented here.
// The replay establishes the discipline but not a fully persisted unified Face-A/Face-B algorithm.
export const FOIL_ALGORITHM_STATUS = "PROTOTYPE_REQUIRED_DO_NOT_INVENT" as const;
