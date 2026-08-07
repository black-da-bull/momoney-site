export const CREATIVE_UST_BLOCK_ORDER = [
  "Theory",
  "Voices",
  "Style",
  "Timbre",
  "Performance",
  "Post-Production",
  "LYRICS BLOCK",
] as const;

export const CREATIVE_UST_FIELDS = {
  Theory: ["mode", "tonal_center", "meter", "tempo", "chord_color"],
  Voices: ["performers", "register", "delivery", "expression", "layering", "articulation"],
  Style: ["genre", "era", "intent", "texture", "aesthetic", "focus"],
  Timbre: ["drum_tone", "bass_tone", "keyboard_tone", "guitar_tone", "fx_palette", "vocal_tone"],
  Performance: ["execution", "gesture", "rhythm_handling", "touch", "phrasing_ops"],
  "Post-Production": ["mastering", "mix_notes", "automation_priorities", "cleanup_rules"],
} as const;

export const CREATIVE_UST_FORBIDDEN_BLOCKS = ["Road-Map", "Roadmap", "CREW_TAGS", "Standalone FX"] as const;

export interface CreativeUstSection {
  title: string;
  bars: number | null;
  performanceNotes: string[];
  productionCues: string[];
  lyricLines: string[];
}

export interface CreativeUstSurface {
  sourceSnapshotHash: string;
  sourceLockHash: string;
  blocks: Record<string, Record<string, string | string[] | number | null>>;
  sections: CreativeUstSection[];
  endsWithEndMarker: boolean;
}

export interface ShowSummarySurface {
  sourceSnapshotHash: string;
  sourceLockHash: string;
  text: string;
}

export interface PersonaSurface {
  sourceSnapshotHash: string;
  sourceLockHash: string;
  styleLine: string;
  profile: string;
}

export function validateLyricWordLock(sourceWords: string[], renderedWords: string[]): boolean {
  if (sourceWords.length !== renderedWords.length) return false;
  return sourceWords.every((word, index) => word === renderedWords[index]);
}

export function validateCreativeBlockOrder(blocks: string[]): boolean {
  return CREATIVE_UST_BLOCK_ORDER.every((expected, index) => blocks[index] === expected);
}
