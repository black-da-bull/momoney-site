// House standards — operator-set laws that govern every session, every song.
// Files under standards/ are committed VERBATIM (extracted from the operator's own
// input, never paraphrased) and loaded into the system prompt after the soul.
// First standard on file: the lyric quality baseline — the anti-corny firewall.

import { readdirSync, readFileSync } from "fs";
import path from "path";

let cached: string | null = null;

export function loadStandards(): string {
  if (cached !== null) return cached;
  const dir = path.join(process.cwd(), "standards");
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  } catch {
    cached = "";
    return cached;
  }
  if (!files.length) {
    cached = "";
    return cached;
  }
  const parts = files.map((f) => readFileSync(path.join(dir, f), "utf8").trim());
  cached =
    `\n\n---\n\n## HOUSE STANDARDS (operator-set — binding on everything you produce)\n\n` +
    parts.join("\n\n---\n\n");
  return cached;
}
