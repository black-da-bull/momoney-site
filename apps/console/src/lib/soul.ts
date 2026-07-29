// The soul is the committed MAESTRO_v0.md, verbatim — the literal system prompt.
// It is read from disk (never inlined/paraphrased) so the file stays the source of truth.

import { readFileSync } from "fs";
import path from "path";

let cached: string | null = null;

export function loadSoul(): string {
  if (cached) return cached;
  const p = path.join(process.cwd(), "soul", "MAESTRO_v0.md");
  cached = readFileSync(p, "utf8");
  return cached;
}
