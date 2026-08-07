// Live Maestro runtime prompt loader.
// The historical MAESTRO_v0.md remains in the repository as derivative evidence,
// but execution must load the current core runtime materialization.

import { readFileSync } from "fs";
import path from "path";

let cached: string | null = null;

export function loadSoul(): string {
  if (cached) return cached;
  const p = path.join(process.cwd(), "soul", "MAESTRO_CORE_RUNTIME_v0.1.md");
  cached = readFileSync(p, "utf8");
  return cached;
}
