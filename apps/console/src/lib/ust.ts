// The song's canonical memory — Maestro Technical UST core runtime contract v0.1.
// Eight active axes × five keys × five subkeys = 200 reserved canonical addresses.
// VIS remains a dormant extension hook and is not part of the 200-address audio core.

export type SlotStatus = "NULL" | "PROPOSED" | "PRESSURED" | "RESOLVED" | "JUSTIFIED_OPEN" | "BLOCKED" | "LOCKED";

export interface Slot {
  address: string; // AXIS.Kn.Sn
  axis: string;
  key: string; // Kn.Sn for backward-compatible pipeline lookup
  keyIndex: number;
  subkeyIndex: number;
  value: string | null;
  status: SlotStatus;
  owner: string;
  contributors: string[];
  sourceRefs: string[];
  rationale: string | null;
  upstreamDependencies: string[];
  downstreamDependents: string[];
  semEvidence: string[];
  contradictionIds: string[];
  dissentIds: string[];
  lockState: "OPEN" | "DRAFT_FROZEN" | "DEFINITIVE_LOCKED";
  provenance: string;
  updatedAt: string;
}

export interface AxisDef {
  code: string;
  name: string;
  owner: string;
  dormant?: boolean;
  keys: string[];
}

function canonicalKeys(): string[] {
  return Array.from({ length: 5 }, (_, key) =>
    Array.from({ length: 5 }, (_, subkey) => `K${key + 1}.S${subkey + 1}`),
  ).flat();
}

const CORE_KEYS = canonicalKeys();

export const AXES: AxisDef[] = [
  { code: "THY", name: "Theory", owner: "EMP-06", keys: CORE_KEYS },
  { code: "VOC", name: "Vocals", owner: "EMP-10", keys: CORE_KEYS },
  { code: "STY", name: "Style", owner: "EMP-05", keys: CORE_KEYS },
  { code: "TIM", name: "Timbre", owner: "EMP-11", keys: CORE_KEYS },
  { code: "PER", name: "Performance", owner: "EMP-09", keys: CORE_KEYS },
  { code: "POST", name: "Post-Production", owner: "EMP-13", keys: CORE_KEYS },
  { code: "MAP", name: "Road Map", owner: "EMP-08", keys: CORE_KEYS },
  { code: "LYR", name: "Lyrics Block", owner: "EMP-07", keys: CORE_KEYS },
  { code: "VIS", name: "Visual Identity", owner: "EXT-VIS", dormant: true, keys: CORE_KEYS },
];

export function activeAxes(): AxisDef[] {
  return AXES.filter((axis) => !axis.dormant);
}

export function canonicalCoreAddresses(): string[] {
  return activeAxes().flatMap((axis) => axis.keys.map((key) => `${axis.code}.${key}`));
}

export function emptyGrid(): Slot[] {
  const now = new Date().toISOString();
  return AXES.flatMap((axis) =>
    axis.keys.map((key) => {
      const match = /^K(\d+)\.S(\d+)$/.exec(key);
      return {
        address: `${axis.code}.${key}`,
        axis: axis.code,
        key,
        keyIndex: Number(match?.[1] ?? 0),
        subkeyIndex: Number(match?.[2] ?? 0),
        value: null,
        status: "NULL" as SlotStatus,
        owner: axis.owner,
        contributors: [],
        sourceRefs: [],
        rationale: null,
        upstreamDependencies: [],
        downstreamDependents: [],
        semEvidence: [],
        contradictionIds: [],
        dissentIds: [],
        lockState: "OPEN" as const,
        provenance: "reserved-address",
        updatedAt: now,
      };
    }),
  );
}

export function coreGrid(grid: Slot[]): Slot[] {
  return grid.filter((slot) => activeAxes().some((axis) => axis.code === slot.axis));
}

export function verifyCoreTopology(grid: Slot[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const expected = canonicalCoreAddresses();
  const actual = coreGrid(grid).map((slot) => slot.address);
  if (actual.length !== 200) errors.push(`expected 200 core addresses, found ${actual.length}`);
  const unique = new Set(actual);
  if (unique.size !== actual.length) errors.push("duplicate canonical addresses detected");
  for (const address of expected) if (!unique.has(address)) errors.push(`missing ${address}`);
  return { ok: errors.length === 0, errors };
}

/** Compact prompt-facing rendering of decided state. Nulls remain in the stored grid. */
export function compactUST(grid: Slot[]): string {
  const lines: string[] = [];
  for (const axis of activeAxes()) {
    const filled = grid.filter((slot) => slot.axis === axis.code && slot.value != null);
    if (!filled.length) continue;
    lines.push(
      `${axis.name}: ` +
        filled
          .map((slot) => `${slot.key}=${slot.value}${slot.status === "LOCKED" ? " [locked]" : slot.status === "JUSTIFIED_OPEN" ? " [open]" : ""}`)
          .join("; "),
    );
  }
  return lines.length ? lines.join("\n") : "(all 200 core addresses remain reserved nulls)";
}

export function findSlot(grid: Slot[], address: string): Slot | undefined {
  return grid.find((slot) => slot.address === address);
}

/** Apply a bounded proposal. Locked or artist-set addresses cannot be overwritten by inference. */
export function applyProposal(
  grid: Slot[],
  address: string,
  value: string,
  provenance: string,
): { ok: boolean; reason?: string; prior?: Slot } {
  const slot = findSlot(grid, address);
  if (!slot) return { ok: false, reason: `unknown address ${address}` };
  const axis = AXES.find((candidate) => candidate.code === slot.axis);
  if (axis?.dormant) return { ok: false, reason: `axis ${slot.axis} is dormant` };
  if (slot.status === "LOCKED" || slot.lockState === "DEFINITIVE_LOCKED") return { ok: false, reason: `${address} is locked` };
  if (slot.provenance === "artist" && !provenance.startsWith("artist")) {
    return { ok: false, reason: `${address} is artist-set; inference may not overwrite it` };
  }
  const prior = { ...slot };
  slot.value = value;
  slot.status = "PROPOSED";
  slot.provenance = provenance;
  slot.updatedAt = new Date().toISOString();
  return { ok: true, prior };
}
