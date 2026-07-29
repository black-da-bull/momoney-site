// The factory (soul §4) — build mode only.
// Sequential axis fill → round-robin pressure → resolve → FOIL reverse processing →
// concurrent triad drafting → budget check → package. Quality runs alongside as taste;
// the house standards (anti-corny firewall) bind every lyric surface.
// Everything the run produces is a PROPOSAL until the artist accepts & locks.

import Anthropic from "@anthropic-ai/sdk";
import { loadSoul } from "./soul";
import { loadStandards } from "./standards";
import {
  Project,
  BuildRun,
  ReviewNote,
  Triad,
  appendChange,
  save,
} from "./store";
import { activeAxes, compactUST, findSlot, Slot } from "./ust";

const MODEL = process.env.MAESTRO_MODEL || "claude-sonnet-5";

// Axis owners — the staff member whose ear leads each axis (soul §3).
const AXIS_OWNERS: Record<string, string> = {
  THY: "Melody Scout — motif DNA, hook identity, singability",
  VOC: "Vanessa — performance believability, delivery truth",
  STY: "Metro — feel, cultural truth, lived resonance",
  TIM: "Analog Confessor — aesthetic world, era and texture coherence",
  PER: "Dave — pocket, groove, rhythmic catchability",
  POST: "Eldrik — feasibility, spectral collision, capture integrity",
  MAP: "Alan — arrangement, space, entrances/exits, negative space",
  LYR: "Sage — lyric motion, emotional plot, why-this-line-now",
};

// Character budgets (operator canon): spend the room to hold nuance, never to pad.
const BUDGETS = {
  creativeUst: 4995,
  showSummary: 1000,
  personaProfile: 2000,
  personaStyleLine: 150,
};

export type Emit = (event: Record<string, unknown>) => void;

function seal(str: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}

function parseJSON<T>(raw: string): T | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const a = cleaned.indexOf("{");
    const b = cleaned.indexOf("[");
    const start = a < 0 ? b : b < 0 ? a : Math.min(a, b);
    if (start < 0) return null;
    try {
      return JSON.parse(cleaned.slice(start)) as T;
    } catch {
      return null;
    }
  }
}

async function ask(client: Anthropic, system: string, user: string, maxTokens = 1600): Promise<string> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function songDossier(project: Project): string {
  const recentTalk = project.messages
    .filter((m) => m.text.trim())
    .slice(-12)
    .map((m) => `${m.role === "artist" ? "ARTIST" : "MAESTRO"}: ${m.text.slice(0, 1500)}`)
    .join("\n\n");
  return `PROJECT: "${project.title}"

ARTIST'S ORIGINAL SEED (verbatim, immutable):
${project.seedRaw ?? "(none yet)"}

THE SONG'S MEMORY SO FAR:
${compactUST(project.grid)}

RECENT SESSION TALK:
${recentTalk || "(none)"}`;
}

export async function runBuild(project: Project, emit: Emit): Promise<BuildRun> {
  const client = new Anthropic();
  const base = loadSoul() + loadStandards();
  const dossier = songDossier(project);

  const run: BuildRun = {
    id: `run-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    stages: [],
    reviewNotes: [],
    defended: [],
    foil: null,
    triad: null,
    hash: null,
    accepted: false,
  };
  project.runs.push(run);

  const stage = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const s = { name, status: "running" as const, note: "" };
    run.stages.push(s);
    emit({ type: "stage", name, status: "running" });
    try {
      const out = await fn();
      (s as { status: string }).status = "done";
      emit({ type: "stage", name, status: "done", note: s.note });
      await save(project);
      return out;
    } catch (err) {
      (s as { status: string }).status = "failed";
      s.note = err instanceof Error ? err.message : "failed";
      emit({ type: "stage", name, status: "failed", note: s.note });
      await save(project);
      throw err;
    }
  };

  // ── 1 · Sequential axis fill — zero-skip, fill-or-defend ──────────────────
  for (const ax of activeAxes()) {
    await stage(`fill:${ax.code}`, async () => {
      const open = project.grid.filter((sl) => sl.axis === ax.code && sl.value == null);
      if (!open.length) return;
      const owner = AXIS_OWNERS[ax.code] ?? "the room";
      const raw = await ask(
        client,
        base +
          `\n\n---\n\nBUILD MODE — axis fill. You are listening through ${owner}. ` +
          `Decide the open keys of the ${ax.name} axis for THIS song, from the dossier. ` +
          `FILL with a concise value (≤14 words, concrete, this song only) or DEFEND ` +
          `(the artist must decide — use sparingly, with a real why). Never invent detail ` +
          `the dossier can't support; that's what DEFEND is for. ` +
          `Return ONLY JSON: {"keys":[{"key":"...","action":"FILL|DEFEND","value":"...or null","why":"..."}]}`,
        `${dossier}\n\nOPEN KEYS ON ${ax.code}: ${open.map((o) => o.key).join(", ")}`,
        1200,
      );
      const parsed = parseJSON<{ keys: { key: string; action: string; value: string | null; why: string }[] }>(raw);
      for (const k of parsed?.keys ?? []) {
        const slot = findSlot(project.grid, `${ax.code}.${k.key}`);
        if (!slot || slot.value != null || slot.status === "LOCKED") continue;
        if (k.action === "FILL" && k.value?.trim()) {
          slot.value = k.value.trim();
          slot.status = "PROPOSED";
          slot.provenance = `worker ${owner.split(" — ")[0]}: ${k.why || "build fill"}`;
          slot.updatedAt = new Date().toISOString();
          appendChange(project, {
            address: slot.address,
            from: null,
            to: slot.value,
            status: "PROPOSED",
            provenance: slot.provenance,
            note: `build ${run.id} axis fill`,
          });
        } else {
          slot.provenance = `defended: ${k.why || "artist decision"}`;
          slot.updatedAt = new Date().toISOString();
          run.defended.push({ address: slot.address, why: k.why || "artist decision" });
        }
      }
    });
  }

  // ── 2 · Draft freeze (nulls preserved as signal) ──────────────────────────
  await stage("draft-freeze", async () => {
    run.hash = seal(JSON.stringify(project.grid));
  });

  // ── 3 · Round-robin — disagreement kept visible, real notes ───────────────
  const conflicts = await stage("round-robin", async () => {
    const raw = await ask(
      client,
      base +
        `\n\n---\n\nBUILD MODE — round-robin. The staff pressure-tests the frozen draft. ` +
        `Each voice speaks from its own ear (Mo standards · Canon structure · Metro feel · ` +
        `Eldrik feasibility · Sage lyric motion · Dave pocket). Real notes, never "looks good". ` +
        `Disagreement stays visible — do not smooth it. Flag a CONFLICT only for real breakage ` +
        `(cross-axis contradiction, spectral collision, a broken breath pattern, standards breach). ` +
        `Return ONLY JSON: {"notes":[{"who":"Mo","severity":"observe|warn|challenge","note":"..."}],` +
        `"conflicts":[{"address":"AXIS.key","issue":"..."}]}`,
      `${dossier}\n\nFROZEN DRAFT:\n${compactUST(project.grid)}`,
      1800,
    );
    const parsed = parseJSON<{ notes: ReviewNote[]; conflicts: { address: string; issue: string }[] }>(raw);
    run.reviewNotes = (parsed?.notes ?? []).slice(0, 20);
    emit({ type: "review", notes: run.reviewNotes });
    return (parsed?.conflicts ?? []).slice(0, 8);
  });

  // ── 4 · Resolve — re-decide only the conflicted addresses ─────────────────
  if (conflicts.length) {
    await stage("resolve", async () => {
      const raw = await ask(
        client,
        base +
          `\n\n---\n\nBUILD MODE — resolve. Re-decide ONLY the conflicted addresses so the ` +
          `song is coherent. Concrete values, ≤14 words. ` +
          `Return ONLY JSON: {"keys":[{"address":"AXIS.key","value":"..."}]}`,
        `${dossier}\n\nCONFLICTS:\n${conflicts.map((c) => `${c.address}: ${c.issue}`).join("\n")}`,
        800,
      );
      const parsed = parseJSON<{ keys: { address: string; value: string }[] }>(raw);
      for (const k of parsed?.keys ?? []) {
        const slot = findSlot(project.grid, k.address);
        if (!slot || slot.status === "LOCKED" || slot.provenance === "artist") continue;
        const prior = slot.value;
        slot.value = k.value;
        slot.status = "RESOLVED";
        slot.updatedAt = new Date().toISOString();
        appendChange(project, {
          address: slot.address,
          from: prior,
          to: k.value,
          status: "RESOLVED",
          provenance: "round-robin resolution",
          note: `build ${run.id} conflict resolved`,
        });
      }
      run.hash = seal(JSON.stringify(project.grid));
    });
  }

  // ── 5 · FOIL — classify recurrence before compressing anything ────────────
  const foil = await stage("foil", async () => {
    const raw = await ask(
      client,
      base +
        `\n\n---\n\nBUILD MODE — FOIL reverse processing. Classify what repeats BEFORE any ` +
        `compression. Traits recurring across the whole song rise into the show summary and ` +
        `persona; unique local detail stays at the leaves (the lyric sheet). ` +
        `Character reduction alone is never the goal — nuance-per-character is. ` +
        `Return ONLY JSON: {"promoteShow":["short phrases"],"promotePersona":["short phrases"]}`,
      `${dossier}\n\nRESOLVED DRAFT:\n${compactUST(project.grid)}`,
      700,
    );
    const parsed = parseJSON<{ promoteShow: string[]; promotePersona: string[] }>(raw);
    run.foil = {
      promoteShow: parsed?.promoteShow ?? [],
      promotePersona: parsed?.promotePersona ?? [],
    };
    emit({ type: "foil", foil: run.foil });
    return run.foil;
  });

  // ── 6 · Concurrent surface drafting — the triad, interdependent ───────────
  let triad = await stage("surfaces", async () => {
    const lyrSlot = project.grid.find((sl) => sl.address === "LYR.locked_text");
    const artistLyrics =
      project.messages.find((m) => m.role === "artist" && /\[LYRICS BLOCK\]/i.test(m.text))?.text ??
      lyrSlot?.value ??
      "";
    const raw = await ask(
      client,
      base +
        `\n\n---\n\nBUILD MODE — triad drafting. Draft the three Suno surfaces TOGETHER, ` +
        `interdependent, each pulling from the locked center (soul §5). The house standards ` +
        `bind every lyric line — run the silent self-check before emitting. ` +
        `\n- creativeUst → Suno lyrics prompt: bracketed section headers ` +
        `[Section | bars | voices | style], quoted lyric lines with breath-scoring (line ` +
        `breaks and blank lines are timing), (adlibs) in parens, **sfx** in bold markers. ` +
        `If the artist provided lyrics, they are LAW — structure and breath-score them, ` +
        `never rewrite a locked line. Budget ≤${BUDGETS.creativeUst} chars — spend the room ` +
        `on nuance, never pad.` +
        `\n- showSummary → Suno style prompt: the record painted open to close, the ` +
        `director's eye. Carry the FOIL-promoted globals. ≤${BUDGETS.showSummary} chars.` +
        `\n- personaProfile → Suno persona bio: who is singing, identity and continuity. ` +
        `Carry the FOIL-promoted identity essence. ≤${BUDGETS.personaProfile} chars.` +
        `\n- personaStyleLine: one tight line. ≤${BUDGETS.personaStyleLine} chars.` +
        `\nReturn ONLY JSON: {"creativeUst":"...","showSummary":"...","personaProfile":"...","personaStyleLine":"..."}`,
      `${dossier}\n\nRESOLVED DRAFT:\n${compactUST(project.grid)}\n\nFOIL PROMOTIONS:\nshow: ${foil.promoteShow.join("; ") || "(none)"}\npersona: ${foil.promotePersona.join("; ") || "(none)"}\n\nARTIST LYRICS (law, if present):\n${artistLyrics.slice(0, 6000) || "(none — Sage drafts to the resolved draft, standards binding)"}`,
      4000,
    );
    const parsed = parseJSON<Triad>(raw);
    if (!parsed?.creativeUst) throw new Error("triad drafting returned no surfaces");
    return parsed;
  });

  // ── 7 · Budget check — lawful compression only, one pass ──────────────────
  await stage("budgets", async () => {
    const over: string[] = [];
    if (triad.creativeUst.length > BUDGETS.creativeUst) over.push(`creativeUst>${BUDGETS.creativeUst}`);
    if (triad.showSummary.length > BUDGETS.showSummary) over.push(`showSummary>${BUDGETS.showSummary}`);
    if (triad.personaProfile.length > BUDGETS.personaProfile) over.push(`personaProfile>${BUDGETS.personaProfile}`);
    if (triad.personaStyleLine.length > BUDGETS.personaStyleLine) over.push(`personaStyleLine>${BUDGETS.personaStyleLine}`);
    if (!over.length) return;
    const raw = await ask(
      client,
      base +
        `\n\n---\n\nBUILD MODE — lawful compression. These surfaces exceed budget: ${over.join(", ")}. ` +
        `Compress lawfully: notation for exact repeats, promote recurring traits, shrink ` +
        `adjectives before nouns and verbs. Bar counts and locked lyric lines are untouchable. ` +
        `Return ONLY the same JSON shape with all four surfaces.`,
      JSON.stringify(triad),
      4000,
    );
    const parsed = parseJSON<Triad>(raw);
    if (parsed?.creativeUst) triad = parsed;
  });

  // ── 8 · Package ───────────────────────────────────────────────────────────
  await stage("package", async () => {
    run.triad = triad;
    run.hash = seal(JSON.stringify({ grid: project.grid, triad }));
    appendChange(project, {
      address: "*",
      from: null,
      to: `triad ${run.id}`,
      status: "PROPOSED",
      provenance: "factory run",
      note: `triad packaged · hash ${run.hash} · PROPOSAL until artist accepts`,
    });
  });

  await save(project);
  emit({ type: "done", runId: run.id, triad: run.triad, defended: run.defended, hash: run.hash });
  return run;
}
