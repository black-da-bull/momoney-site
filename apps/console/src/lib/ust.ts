// The song's memory — the Technical UST (soul §2).
// Eight axes, addressed AXIS.Key.Subkey. Nulls are reserved addresses, not walls.
// VIS is the visual-ready seam: defined, dormant, never filled in the music-first slice.

export type SlotStatus = "NULL" | "PROPOSED" | "PRESSURED" | "RESOLVED" | "LOCKED";

export interface Slot {
  address: string; // e.g. "THY.mode"
  axis: string;
  key: string;
  value: string | null;
  status: SlotStatus;
  provenance: string; // "artist" | "maestro-inference: <why>" | ""
  updatedAt: string;
}

export interface AxisDef {
  code: string;
  name: string;
  dormant?: boolean;
  keys: string[];
}

export const AXES: AxisDef[] = [
  { code: "THY", name: "Theory", keys: ["mode", "meter", "tempo", "harmonic_grammar", "form"] },
  { code: "VOC", name: "Voices", keys: ["lead_identity", "delivery", "cadence", "stacks", "adlibs"] },
  { code: "STY", name: "Style", keys: ["genre_fusion", "era", "intent", "cultural_truth"] },
  { code: "TIM", name: "Timbre", keys: ["drums", "bass", "keys", "guitar", "vocal_tone", "fx_palette"] },
  { code: "PER", name: "Performance", keys: ["pocket", "groove", "dynamics", "humanization"] },
  { code: "POST", name: "Post-Production", keys: ["mix", "space", "loudness", "translation"] },
  { code: "MAP", name: "Roadmap", keys: ["section_order", "bar_counts", "transitions", "energy_curve"] },
  { code: "LYR", name: "Lyrics", keys: ["locked_text", "breath_scoring", "line_control", "theme"] },
  // Visual-ready seam (plan: music-first, visual-ready). Dormant: excluded from
  // conversation context and from quiet fills until the audio-visual phase mounts.
  { code: "VIS", name: "Visual Identity", dormant: true, keys: ["world", "shot_grammar", "identity_lock", "motion"] },
];

export function emptyGrid(): Slot[] {
  const now = new Date().toISOString();
  return AXES.flatMap((ax) =>
    ax.keys.map((k) => ({
      address: `${ax.code}.${k}`,
      axis: ax.code,
      key: k,
      value: null,
      status: "NULL" as SlotStatus,
      provenance: "",
      updatedAt: now,
    })),
  );
}

export function activeAxes(): AxisDef[] {
  return AXES.filter((a) => !a.dormant);
}

/** Compact, prompt-facing rendering of what the song has decided so far. */
export function compactUST(grid: Slot[]): string {
  const lines: string[] = [];
  for (const ax of activeAxes()) {
    const filled = grid.filter((s) => s.axis === ax.code && s.value != null);
    if (!filled.length) continue;
    lines.push(
      `${ax.name}: ` +
        filled
          .map((s) => `${s.key}=${s.value}${s.status === "LOCKED" ? " [locked]" : s.provenance.startsWith("maestro-inference") ? " (inferred)" : ""}`)
          .join("; "),
    );
  }
  return lines.length ? lines.join("\n") : "(nothing decided yet — the song is young)";
}

export function findSlot(grid: Slot[], address: string): Slot | undefined {
  return grid.find((s) => s.address === address);
}

/** Apply a quiet proposal. Never overwrites LOCKED or artist-set values; never touches dormant axes. */
export function applyProposal(
  grid: Slot[],
  address: string,
  value: string,
  provenance: string,
): { ok: boolean; reason?: string; prior?: Slot } {
  const slot = findSlot(grid, address);
  if (!slot) return { ok: false, reason: `unknown address ${address}` };
  const axis = AXES.find((a) => a.code === slot.axis);
  if (axis?.dormant) return { ok: false, reason: `axis ${slot.axis} is dormant` };
  if (slot.status === "LOCKED") return { ok: false, reason: `${address} is locked` };
  if (slot.provenance === "artist" && !provenance.startsWith("artist"))
    return { ok: false, reason: `${address} is artist-set; inference may not overwrite it` };
  const prior = { ...slot };
  slot.value = value;
  slot.status = "PROPOSED";
  slot.provenance = provenance;
  slot.updatedAt = new Date().toISOString();
  return { ok: true, prior };
}
