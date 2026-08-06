// Maestro core runtime build pipeline.
// Sequential zero-skip fill → draft freeze → visible staff pressure → contradiction
// disposition → deterministic gates → definitive derivation lock → FOIL → triad → package.

import Anthropic from "./openai-anthropic-compat";
import { loadSoul } from "./soul";
import { loadStandards } from "./standards";
import {
  Project,
  BuildRun,
  ReviewNote,
  Triad,
  ContradictionRecord,
  DissentRecord,
  GateResult,
  appendChange,
  save,
} from "./store";
import { activeAxes, compactUST, coreGrid, findSlot, verifyCoreTopology } from "./ust";

const MODEL = process.env.OPENAI_MODEL || process.env.MAESTRO_MODEL || "gpt-5-mini";

const AXIS_OWNERS: Record<string, string> = {
  THY: "EMP-06 Melody Scout — motif DNA, hook identity, singability",
  VOC: "EMP-10 Vanessa — performance believability and delivery truth",
  STY: "EMP-05 Metro — feel, cultural truth, lived resonance",
  TIM: "EMP-11 Analog Confessor — aesthetic world and palette coherence",
  PER: "EMP-09 Dave — pocket, groove, rhythmic usability",
  POST: "EMP-13 Eldrik — engineering feasibility and translation",
  MAP: "EMP-08 Alan — arrangement, space, entrances and exits",
  LYR: "EMP-07 Sage — lyric motion, section intent and emotional plot",
};

const STAFF = [
  "EMP-01 Mo", "EMP-02 Canon", "EMP-03 Megazord", "EMP-04 Sibling",
  "EMP-05 Metro", "EMP-06 Melody Scout", "EMP-07 Sage", "EMP-08 Alan",
  "EMP-09 Dave", "EMP-10 Vanessa", "EMP-11 Analog Confessor", "EMP-12 Anva", "EMP-13 Eldrik",
];

const BUDGETS = { creativeUst: 4995, showSummary: 1000, personaProfile: 2000, personaStyleLine: 150 };
export type Emit = (event: Record<string, unknown>) => void;

function seal(value: string): string {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return ("00000000" + hash.toString(16)).slice(-8);
}

function parseJSON<T>(raw: string): T | null {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned) as T; } catch {
    const objectStart = cleaned.indexOf("{");
    const arrayStart = cleaned.indexOf("[");
    const start = objectStart < 0 ? arrayStart : arrayStart < 0 ? objectStart : Math.min(objectStart, arrayStart);
    if (start < 0) return null;
    try { return JSON.parse(cleaned.slice(start)) as T; } catch { return null; }
  }
}

async function ask(client: Anthropic, system: string, user: string, maxTokens = 1800): Promise<string> {
  const response = await client.messages.create({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] });
  return response.content.filter((block): block is Anthropic.TextBlock => block.type === "text").map((block) => block.text).join("").trim();
}

function songDossier(project: Project): string {
  const recentTalk = project.messages.filter((message) => message.text.trim()).slice(-12)
    .map((message) => `${message.role === "artist" ? "ARTIST" : "MAESTRO"}: ${message.text.slice(0, 1500)}`).join("\n\n");
  return `PROJECT: "${project.title}"\n\nARTIST'S ORIGINAL SEED (verbatim):\n${project.seedRaw ?? "(none yet)"}\n\nTECHNICAL UST STATE:\n${compactUST(project.grid)}\n\nRECENT SESSION TALK:\n${recentTalk || "(none)"}`;
}

function createGate(project: Project, run: BuildRun, gate: Omit<GateResult, "id" | "at">): GateResult {
  const result: GateResult = { id: `gate-${project.gates.length + 1}`, at: new Date().toISOString(), ...gate };
  project.gates.push(result);
  run.gateResultIds.push(result.id);
  return result;
}

export async function runBuild(project: Project, emit: Emit): Promise<BuildRun> {
  const client = new Anthropic();
  const base = loadSoul() + loadStandards();
  const dossier = songDossier(project);
  const run: BuildRun = {
    id: `run-${Date.now().toString(36)}`, at: new Date().toISOString(), stages: [], reviewNotes: [], defended: [],
    contradictionIds: [], dissentIds: [], gateResultIds: [], foil: null, triad: null,
    draftFreezeHash: null, definitiveLockHash: null, hash: null, accepted: false,
  };
  project.runs.push(run);

  const stage = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
    const stageRecord = { name, status: "running" as const, note: "" };
    run.stages.push(stageRecord);
    emit({ type: "stage", name, status: "running" });
    try {
      const output = await operation();
      (stageRecord as { status: string }).status = "done";
      emit({ type: "stage", name, status: "done", note: stageRecord.note });
      await save(project);
      return output;
    } catch (error) {
      (stageRecord as { status: string }).status = "failed";
      stageRecord.note = error instanceof Error ? error.message : "failed";
      emit({ type: "stage", name, status: "failed", note: stageRecord.note });
      await save(project);
      throw error;
    }
  };

  const topology = verifyCoreTopology(project.grid);
  if (!topology.ok) throw new Error(`Technical UST topology failure: ${topology.errors.join("; ")}`);

  for (const axis of activeAxes()) {
    await stage(`fill:${axis.code}`, async () => {
      const open = project.grid.filter((slot) => slot.axis === axis.code && slot.value == null && slot.status !== "JUSTIFIED_OPEN");
      if (!open.length) return;
      const owner = AXIS_OWNERS[axis.code];
      const raw = await ask(client, base + `\n\nBUILD MODE — sequential ${axis.name} completion. You are ${owner}. Return one disposition for EVERY listed address. FILL requires concise defensible content. DEFEND preserves null with a specific reason. Never omit an address. Return ONLY JSON: {"items":[{"address":"${axis.code}.K1.S1","action":"FILL|DEFEND","value":null,"why":"..."}]}`,
        `${dossier}\n\nOPEN ADDRESSES (${open.length}):\n${open.map((slot) => slot.address).join("\n")}`, 3200);
      const parsed = parseJSON<{ items: { address: string; action: "FILL" | "DEFEND"; value: string | null; why: string }[] }>(raw);
      const items = parsed?.items ?? [];
      const byAddress = new Map(items.map((item) => [item.address, item]));
      const missing = open.filter((slot) => !byAddress.has(slot.address));
      if (missing.length) throw new Error(`${axis.code} zero-skip failure: ${missing.map((slot) => slot.address).join(", ")}`);
      for (const slot of open) {
        const item = byAddress.get(slot.address)!;
        if (item.action === "FILL" && item.value?.trim()) {
          slot.value = item.value.trim();
          slot.status = "PROPOSED";
          slot.rationale = item.why || "employee fill";
          slot.provenance = `worker ${owner}`;
          slot.contributors = [owner.split(" ")[0]];
          appendChange(project, { address: slot.address, from: null, to: slot.value, status: "PROPOSED", provenance: slot.provenance, note: item.why || `build ${run.id}` });
        } else {
          slot.value = null;
          slot.status = "JUSTIFIED_OPEN";
          slot.rationale = item.why || "artist decision required";
          slot.provenance = `defended by ${owner}`;
          run.defended.push({ address: slot.address, why: slot.rationale });
          appendChange(project, { address: slot.address, from: null, to: null, status: "JUSTIFIED_OPEN", provenance: slot.provenance, note: slot.rationale });
        }
        slot.updatedAt = new Date().toISOString();
      }
    });
  }

  await stage("draft-freeze", async () => {
    const unlawful = coreGrid(project.grid).filter((slot) => slot.value == null && slot.status !== "JUSTIFIED_OPEN");
    if (unlawful.length) throw new Error(`draft freeze blocked by ${unlawful.length} undispositioned addresses`);
    for (const slot of coreGrid(project.grid)) slot.lockState = "DRAFT_FROZEN";
    run.draftFreezeHash = seal(JSON.stringify(coreGrid(project.grid)));
  });

  const conflictCandidates = await stage("round-robin", async () => {
    const raw = await ask(client, base + `\n\nBUILD MODE — visible thirteen-employee round-robin. Participants: ${STAFF.join(" · ")}. Each note must name its employee, lawful domain basis, exact address, predicted failure, and severity. Do not smooth disagreement. Return ONLY JSON: {"notes":[{"who":"EMP-01 Mo","address":"THY.K1.S1","severity":"observe|warn|challenge","domainBasis":"...","note":"...","predictedFailure":"..."}],"conflicts":[{"address":"AXIS.Kn.Sn","issue":"...","type":"cross_axis|ownership|feasibility|excellence|continuity|authorship|downstream_projection","blocking":true}]}`,
      `${dossier}\n\nFROZEN DRAFT:\n${compactUST(project.grid)}`, 3600);
    const parsed = parseJSON<{ notes: (ReviewNote & { address?: string; domainBasis?: string; predictedFailure?: string })[]; conflicts: { address: string; issue: string; type: ContradictionRecord["conflictType"]; blocking: boolean }[] }>(raw);
    run.reviewNotes = (parsed?.notes ?? []).slice(0, 30).map((note) => ({ who: note.who, note: note.note, severity: note.severity }));
    for (const note of parsed?.notes ?? []) {
      if (note.severity !== "challenge") continue;
      const dissent: DissentRecord = {
        id: `dissent-${project.dissent.length + 1}`, employeeId: note.who, addresses: note.address ? [note.address] : [],
        objection: note.note, domainBasis: note.domainBasis || "employee domain challenge", predictedFailure: note.predictedFailure || "unresolved downstream risk",
        severity: "material", disposition: "open", impactAcknowledged: false, at: new Date().toISOString(),
      };
      project.dissent.push(dissent); run.dissentIds.push(dissent.id);
    }
    emit({ type: "review", notes: run.reviewNotes });
    return (parsed?.conflicts ?? []).slice(0, 12);
  });

  for (const candidate of conflictCandidates) {
    const contradiction: ContradictionRecord = {
      id: `contra-${project.contradictions.length + 1}`, addresses: [candidate.address], issue: candidate.issue,
      conflictType: candidate.type || "cross_axis", materiality: candidate.blocking ? "blocking" : "non_blocking",
      openedBy: "round-robin", openedAt: new Date().toISOString(), resolutionState: "open", resolution: null, closedBy: null, closedAt: null,
    };
    project.contradictions.push(contradiction); run.contradictionIds.push(contradiction.id);
    const slot = findSlot(project.grid, candidate.address); if (slot) slot.contradictionIds.push(contradiction.id);
  }

  if (conflictCandidates.length) {
    await stage("resolve", async () => {
      const raw = await ask(client, base + `\n\nBUILD MODE — resolve only the listed contradictions. Return ONLY JSON: {"items":[{"contradictionId":"contra-1","address":"AXIS.Kn.Sn","value":"...","resolution":"..."}]}`,
        project.contradictions.filter((item) => run.contradictionIds.includes(item.id)).map((item) => `${item.id} ${item.addresses.join(",")}: ${item.issue}`).join("\n"), 1800);
      const parsed = parseJSON<{ items: { contradictionId: string; address: string; value: string; resolution: string }[] }>(raw);
      for (const item of parsed?.items ?? []) {
        const contradiction = project.contradictions.find((record) => record.id === item.contradictionId);
        const slot = findSlot(project.grid, item.address);
        if (!contradiction || !slot || slot.provenance === "artist") continue;
        const prior = slot.value;
        slot.value = item.value; slot.status = "RESOLVED"; slot.rationale = item.resolution; slot.updatedAt = new Date().toISOString();
        contradiction.resolutionState = "resolved"; contradiction.resolution = item.resolution; contradiction.closedBy = "round-robin"; contradiction.closedAt = new Date().toISOString();
        appendChange(project, { address: slot.address, from: prior, to: item.value, status: "RESOLVED", provenance: "round-robin resolution", note: item.resolution });
      }
    });
  }

  await stage("gates", async () => {
    const blocking = project.contradictions.filter((item) => run.contradictionIds.includes(item.id) && item.materiality === "blocking" && item.resolutionState === "open");
    const undispositioned = coreGrid(project.grid).filter((slot) => slot.value == null && slot.status !== "JUSTIFIED_OPEN");
    const sem = createGate(project, run, {
      gateType: "SEM", evaluatedAddresses: coreGrid(project.grid).map((slot) => slot.address), evidenceRefs: [run.draftFreezeHash || ""],
      findings: ["200-address topology verified", `${run.reviewNotes.length} visible review notes`, `${run.dissentIds.length} dissent records`],
      blockers: [...blocking.map((item) => item.id), ...undispositioned.map((slot) => slot.address)], requiredActions: [],
      verdict: blocking.length || undispositioned.length ? "fail" : "pass", rerouteTarget: blocking[0]?.addresses[0] || undispositioned[0]?.address || null,
    });
    const seg = createGate(project, run, {
      gateType: "SEG", evaluatedAddresses: coreGrid(project.grid).map((slot) => slot.address), evidenceRefs: [sem.id],
      findings: ["canonical topology intact", "zero-skip disposition complete"], blockers: sem.blockers, requiredActions: [], verdict: sem.verdict, rerouteTarget: sem.rerouteTarget,
    });
    emit({ type: "gates", gates: [sem, seg] });
    if (sem.verdict === "fail" || seg.verdict === "fail") throw new Error(`lock blocked: ${sem.blockers.join(", ")}`);
  });

  await stage("definitive-lock", async () => {
    for (const slot of coreGrid(project.grid)) slot.lockState = "DEFINITIVE_LOCKED";
    run.definitiveLockHash = seal(JSON.stringify(coreGrid(project.grid)));
    appendChange(project, { address: "*", from: run.draftFreezeHash, to: run.definitiveLockHash, status: "DEFINITIVE_LOCK", provenance: "runtime gate", note: "lock precedes FOIL and reverse compilation" });
  });

  const foil = await stage("foil", async () => {
    if (!run.definitiveLockHash) throw new Error("FOIL requires definitive lock");
    const raw = await ask(client, base + `\n\nBUILD MODE — FOIL reverse processing over definitively locked Technical UST. Classify recurrence before compression. Promote recurring global traits to Show Summary or A/R Profile; preserve unique local detail. Return ONLY JSON: {"promoteShow":["..."],"promotePersona":["..."]}`,
      `${dossier}\n\nLOCK: ${run.definitiveLockHash}\n${compactUST(project.grid)}`, 1000);
    const parsed = parseJSON<{ promoteShow: string[]; promotePersona: string[] }>(raw);
    run.foil = { promoteShow: parsed?.promoteShow ?? [], promotePersona: parsed?.promotePersona ?? [] };
    emit({ type: "foil", foil: run.foil }); return run.foil;
  });

  let triad = await stage("surfaces", async () => {
    if (!run.definitiveLockHash) throw new Error("surface drafting requires definitive lock");
    const artistLyrics = project.messages.find((message) => message.role === "artist" && /\[LYRICS BLOCK\]/i.test(message.text))?.text ?? "";
    const raw = await ask(client, base + `\n\nBUILD MODE — draft all three downstream surfaces concurrently from lock ${run.definitiveLockHash}. Creative UST ≤${BUDGETS.creativeUst}; Show Summary ≤${BUDGETS.showSummary}; A/R Profile ≤${BUDGETS.personaProfile}; Persona Style ≤${BUDGETS.personaStyleLine}. Artist lyrics are immutable. Return ONLY JSON: {"creativeUst":"...","showSummary":"...","personaProfile":"...","personaStyleLine":"..."}`,
      `${dossier}\n\nLOCKED UST:\n${compactUST(project.grid)}\n\nFOIL SHOW: ${foil.promoteShow.join("; ")}\nFOIL PERSONA: ${foil.promotePersona.join("; ")}\nARTIST LYRICS:\n${artistLyrics.slice(0, 6000) || "(none)"}`, 4200);
    const parsed = parseJSON<Triad>(raw); if (!parsed?.creativeUst) throw new Error("triad drafting returned no surfaces"); return parsed;
  });

  await stage("budgets", async () => {
    const over = [
      triad.creativeUst.length > BUDGETS.creativeUst && `creativeUst>${BUDGETS.creativeUst}`,
      triad.showSummary.length > BUDGETS.showSummary && `showSummary>${BUDGETS.showSummary}`,
      triad.personaProfile.length > BUDGETS.personaProfile && `personaProfile>${BUDGETS.personaProfile}`,
      triad.personaStyleLine.length > BUDGETS.personaStyleLine && `personaStyleLine>${BUDGETS.personaStyleLine}`,
    ].filter(Boolean) as string[];
    if (!over.length) return;
    const raw = await ask(client, base + `\n\nCompress lawfully without changing locked lyrics, bar counts, or local unique detail. Overages: ${over.join(", ")}. Return the same four-field JSON.`, JSON.stringify(triad), 4200);
    const parsed = parseJSON<Triad>(raw); if (parsed?.creativeUst) triad = parsed;
  });

  await stage("package", async () => {
    run.triad = triad; run.hash = seal(JSON.stringify({ lock: run.definitiveLockHash, triad }));
    appendChange(project, { address: "*", from: null, to: `triad ${run.id}`, status: "PROPOSED", provenance: "factory run", note: `derived from definitive lock ${run.definitiveLockHash}; artist acceptance still required` });
  });

  await save(project);
  emit({ type: "done", runId: run.id, triad: run.triad, defended: run.defended, hash: run.hash, definitiveLockHash: run.definitiveLockHash });
  return run;
}
