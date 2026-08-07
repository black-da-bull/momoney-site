// Maestro core runtime pipeline.
// PRE-LOCK: employee work + paired SEM -> draft freeze -> bounded round-robin -> gates -> red-pen -> WAITING_HUMAN.
// POST-LOCK: operator lock -> FOIL -> derivative surfaces -> package.

import Anthropic from "./openai-anthropic-compat";
import { loadSoul } from "./soul";
import { loadStandards } from "./standards";
import { EMPLOYEES, axisOwner, employeeById } from "./employees";
import {
  Project,
  BuildRun,
  ReviewNote,
  Triad,
  ContradictionRecord,
  DissentRecord,
  GateResult,
  EmployeeTurnResult,
  SemDelta,
  GCard,
  appendChange,
  save,
} from "./store";
import { activeAxes, compactUST, coreGrid, findSlot, verifyCoreTopology } from "./ust";

const MODEL = process.env.OPENAI_MODEL || process.env.MAESTRO_MODEL || "gpt-5-mini";
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
  const recentTalk = project.messages.filter((message) => message.text.trim()).slice(-16)
    .map((message) => `${message.role === "artist" ? "ARTIST" : "MAESTRO"}: ${message.text.slice(0, 2200)}`).join("\n\n");
  return `PROJECT: "${project.title}"\n\nARTIST RAW SOURCE (verbatim):\n${project.seedRaw ?? "(none yet)"}\n\nTECHNICAL UST STATE:\n${compactUST(project.grid)}\n\nRECENT SESSION TALK:\n${recentTalk || "(none)"}`;
}

function createGate(project: Project, run: BuildRun, gate: Omit<GateResult, "id" | "at">): GateResult {
  const result: GateResult = { id: `gate-${project.gates.length + 1}`, at: new Date().toISOString(), ...gate };
  project.gates.push(result);
  run.gateResultIds.push(result.id);
  return result;
}

function semStopFlags(turns: EmployeeTurnResult[]): string[] {
  return turns.flatMap((turn) => turn.semDeltas.flatMap((delta) => delta.stopFlags)).filter(Boolean);
}

function makeGCard(project: Project, run: BuildRun, turn: EmployeeTurnResult): GCard {
  const blockers = turn.semDeltas.flatMap((delta) => delta.stopFlags).filter(Boolean);
  const conditional = turn.semDeltas.filter((delta) => delta.disposition === "conditional");
  const holds = turn.semDeltas.filter((delta) => delta.disposition === "hold");
  const card: GCard = {
    id: `gcard-${project.gCards.length + 1}`,
    employeeTurnId: turn.id,
    verdict: blockers.length || holds.length ? "HOLD" : conditional.length ? "CONDITIONAL" : "PASS",
    score: null,
    deficiencies: turn.semDeltas.filter((delta) => delta.issueType && delta.issueType !== "none").map((delta) => `${delta.address}: ${delta.issueType}`),
    requiredActions: turn.semDeltas.map((delta) => delta.nextAction).filter((value): value is string => Boolean(value)),
    blockingFlags: blockers,
    addressPointers: turn.assignedAddresses,
    at: new Date().toISOString(),
  };
  project.gCards.push(card);
  run.gCardIds.push(card.id);
  return card;
}

function stageRunner(project: Project, run: BuildRun, emit: Emit) {
  return async function stage<T>(name: string, operation: () => Promise<T>): Promise<T> {
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
      run.phase = "FAILED";
      emit({ type: "stage", name, status: "failed", note: stageRecord.note });
      await save(project);
      throw error;
    }
  };
}

type AxisItem = {
  address: string;
  action: "FILL" | "DEFEND" | "ESCALATE";
  value: string | null;
  why: string;
  sem: SemDelta;
};

type AxisTurnPayload = {
  summary: string;
  items: AxisItem[];
  escalations?: { addresses: string[]; reason: string; target: string }[];
  challenges?: { addresses: string[]; issue: string; severity: "advisory" | "material" | "blocking" }[];
  downstreamRisks?: { addresses: string[]; risk: string }[];
  objections?: { addresses: string[]; objection: string }[];
  evidence?: string[];
};

function validateAxisTurn(axis: string, assigned: string[], payload: AxisTurnPayload | null): AxisTurnPayload {
  if (!payload || !Array.isArray(payload.items)) throw new Error(`${axis} employee turn did not return structured items`);
  const byAddress = new Map(payload.items.map((item) => [item.address, item]));
  const missing = assigned.filter((address) => !byAddress.has(address));
  if (missing.length) throw new Error(`${axis} zero-skip failure: ${missing.join(", ")}`);
  const unknown = payload.items.filter((item) => !assigned.includes(item.address));
  if (unknown.length) throw new Error(`${axis} employee returned out-of-manifest addresses: ${unknown.map((item) => item.address).join(", ")}`);
  for (const item of payload.items) {
    if (!item.sem || item.sem.address !== item.address) throw new Error(`${axis} missing paired SEM delta for ${item.address}`);
    for (const value of Object.values(item.sem.scores ?? {})) {
      if (typeof value !== "number" || value < 0 || value > 5) throw new Error(`${axis} invalid SEM score at ${item.address}`);
    }
  }
  return payload;
}

function recordAxisTurn(project: Project, run: BuildRun, axis: string, assigned: string[], payload: AxisTurnPayload): EmployeeTurnResult {
  const owner = axisOwner(axis);
  if (!owner.writableAxes.includes(axis)) throw new Error(`${owner.id} is not authorized to write ${axis}`);

  const turn: EmployeeTurnResult = {
    id: `turn-${project.employeeTurns.length + 1}`,
    employeeId: owner.id,
    axis,
    assignedAddresses: assigned,
    summary: payload.summary || `${owner.name} completed assigned ${axis} work`,
    proposedUstDeltas: [],
    preservedNulls: [],
    escalations: payload.escalations ?? [],
    challenges: payload.challenges ?? [],
    semDeltas: payload.items.map((item) => item.sem),
    downstreamRisks: payload.downstreamRisks ?? [],
    objections: payload.objections ?? [],
    evidence: payload.evidence ?? [],
    at: new Date().toISOString(),
  };

  for (const item of payload.items) {
    const slot = findSlot(project.grid, item.address);
    if (!slot || slot.axis !== axis) throw new Error(`${owner.id} attempted out-of-domain write ${item.address}`);
    if (item.action === "FILL") {
      if (!item.value?.trim()) throw new Error(`${item.address} FILL had no value`);
      slot.value = item.value.trim();
      slot.status = "PROPOSED";
      slot.rationale = item.why || "employee proposal";
      slot.provenance = `${owner.id} ${owner.name}`;
      slot.contributors = [owner.id];
      slot.updatedAt = new Date().toISOString();
      turn.proposedUstDeltas.push({ address: item.address, value: slot.value, rationale: slot.rationale });
      appendChange(project, { address: item.address, from: null, to: slot.value, status: "PROPOSED", provenance: slot.provenance, note: slot.rationale });
    } else if (item.action === "DEFEND") {
      slot.value = null;
      slot.status = "JUSTIFIED_OPEN";
      slot.rationale = item.why || "preserved null by lawful employee";
      slot.provenance = `${owner.id} ${owner.name}`;
      slot.updatedAt = new Date().toISOString();
      turn.preservedNulls.push({ address: item.address, why: slot.rationale });
      run.defended.push({ address: item.address, why: slot.rationale });
      appendChange(project, { address: item.address, from: null, to: null, status: "JUSTIFIED_OPEN", provenance: slot.provenance, note: slot.rationale });
    } else {
      slot.status = "BLOCKED";
      slot.rationale = item.why || "employee escalation";
      slot.provenance = `${owner.id} ${owner.name}`;
      slot.updatedAt = new Date().toISOString();
      turn.escalations.push({ addresses: [item.address], reason: slot.rationale, target: "operator" });
      appendChange(project, { address: item.address, from: null, to: null, status: "BLOCKED", provenance: slot.provenance, note: slot.rationale });
    }
  }

  project.employeeTurns.push(turn);
  run.employeeTurnIds.push(turn.id);
  makeGCard(project, run, turn);
  return turn;
}

export async function runBuild(project: Project, emit: Emit): Promise<BuildRun> {
  const client = new Anthropic();
  const base = loadSoul() + loadStandards();
  const dossier = songDossier(project);
  const run: BuildRun = {
    id: `run-${Date.now().toString(36)}`,
    at: new Date().toISOString(),
    phase: "INTAKE",
    stages: [],
    reviewNotes: [],
    defended: [],
    employeeTurnIds: [],
    contradictionIds: [],
    dissentIds: [],
    gateResultIds: [],
    gCardIds: [],
    foil: null,
    triad: null,
    draftFreezeHash: null,
    definitiveLockHash: null,
    hash: null,
    operatorLockAt: null,
    surfaceFrozenAt: null,
    accepted: false,
  };
  project.runs.push(run);
  const stage = stageRunner(project, run, emit);

  await stage("initialize-ust", async () => {
    const topology = verifyCoreTopology(project.grid);
    if (!topology.ok) throw new Error(`Technical UST topology failure: ${topology.errors.join("; ")}`);
    run.phase = "UST_INITIALIZED";
  });

  run.phase = "SEQUENTIAL_AXIS_WORK";
  for (const axis of activeAxes()) {
    await stage(`employee:${axis.code}`, async () => {
      const open = project.grid.filter((slot) => slot.axis === axis.code && slot.lockState === "OPEN" && (slot.value == null || slot.status === "NULL_RESERVED" || slot.status === "BLOCKED"));
      if (!open.length) return;
      const owner = axisOwner(axis.code);
      const assigned = open.map((slot) => slot.address);
      const employeeSystem = `${base}\n\nEMPLOYEE RUNTIME CONTRACT\nEmployee: ${owner.id} ${owner.name}\nMission: ${owner.mission}\nWritable axes: ${owner.writableAxes.join(", ") || "none"}\nReview axes: ${owner.reviewAxes.join(", ") || "none"}\nNon-authority: ${owner.nonAuthority.join(" ")}\nChallenge obligation: ${owner.challengeObligation}\n\nYou are executing one bounded employee turn, not speaking as generic Maestro. The controller assigned exactly the addresses below. You may not write any other address. Every address requires one disposition and a paired SEM delta. SEM dimensions are K1 Structural viability, K2 Cross-axis coherence, K3 Creative strength, K4 Performance truth, K5 Sonic identity, K6 Compression survivability, K7 External viability; score only applicable dimensions 0..5. Artist-supplied lyrics are immutable unless explicit authorization exists. Return JSON only.`;
      const raw = await ask(
        client,
        employeeSystem,
        `${dossier}\n\nASSIGNED AXIS: ${axis.code} ${axis.name}\nASSIGNED ADDRESSES (${assigned.length}):\n${assigned.join("\n")}\n\nReturn exactly: {"summary":"...","items":[{"address":"${axis.code}.K1.S1","action":"FILL|DEFEND|ESCALATE","value":null,"why":"...","sem":{"address":"${axis.code}.K1.S1","scores":{"K1":0},"issueType":"none|...","evidence":["..."],"disposition":"pass|conditional|hold","nextAction":null,"stopFlags":[]}}],"escalations":[],"challenges":[],"downstreamRisks":[],"objections":[],"evidence":[]}`,
        4200,
      );
      const payload = validateAxisTurn(axis.code, assigned, parseJSON<AxisTurnPayload>(raw));
      const turn = recordAxisTurn(project, run, axis.code, assigned, payload);
      emit({ type: "employee-turn", employeeId: turn.employeeId, axis: axis.code, turnId: turn.id, gCardId: run.gCardIds[run.gCardIds.length - 1] });
    });
  }

  await stage("draft-freeze", async () => {
    const undispositioned = coreGrid(project.grid).filter((slot) => slot.value == null && slot.status !== "JUSTIFIED_OPEN" && slot.status !== "BLOCKED");
    if (undispositioned.length) throw new Error(`draft freeze blocked by ${undispositioned.length} undispositioned addresses`);
    for (const slot of coreGrid(project.grid)) slot.lockState = "DRAFT_FROZEN";
    run.draftFreezeHash = seal(JSON.stringify(coreGrid(project.grid)));
    run.phase = "DRAFT_FREEZE";
  });

  await stage("round-robin", async () => {
    run.phase = "ROUND_ROBIN";
    const frozen = compactUST(project.grid);
    const reviewPayloads = await Promise.all(EMPLOYEES.map(async (employee) => {
      const system = `${base}\n\nBOUNDED REVIEW TURN\nEmployee: ${employee.id} ${employee.name}\nMission: ${employee.mission}\nReview axes: ${employee.reviewAxes.join(", ") || "all by governance"}\nNon-authority: ${employee.nonAuthority.join(" ")}\nChallenge obligation: ${employee.challengeObligation}\n\nThis is review only. Do not write or resolve Technical UST content. Return visible challenges, dissent, risks, and exact address pointers. JSON only.`;
      const raw = await ask(client, system, `${dossier}\n\nDRAFT FREEZE ${run.draftFreezeHash}:\n${frozen}\n\nReturn {"summary":"...","notes":[{"address":"AXIS.Kn.Sn","severity":"observe|warn|challenge","domainBasis":"...","note":"...","predictedFailure":"..."}],"conflicts":[{"addresses":["AXIS.Kn.Sn"],"issue":"...","type":"cross_axis|ownership|feasibility|excellence|continuity|authorship|downstream_projection","blocking":true}]}`, 1400);
      return { employee, parsed: parseJSON<{ summary?: string; notes?: { address: string; severity: "observe" | "warn" | "challenge"; domainBasis: string; note: string; predictedFailure: string }[]; conflicts?: { addresses: string[]; issue: string; type: ContradictionRecord["conflictType"]; blocking: boolean }[] }>(raw) };
    }));

    for (const { employee, parsed } of reviewPayloads) {
      for (const note of parsed?.notes ?? []) {
        run.reviewNotes.push({ who: `${employee.id} ${employee.name}`, note: note.note, severity: note.severity });
        if (note.severity === "challenge") {
          const dissent: DissentRecord = {
            id: `dissent-${project.dissent.length + 1}`,
            employeeId: employee.id,
            addresses: note.address ? [note.address] : [],
            objection: note.note,
            domainBasis: note.domainBasis || employee.mission,
            predictedFailure: note.predictedFailure || "unresolved downstream risk",
            severity: "material",
            disposition: "open",
            impactAcknowledged: false,
            at: new Date().toISOString(),
          };
          project.dissent.push(dissent);
          run.dissentIds.push(dissent.id);
        }
      }
      for (const conflict of parsed?.conflicts ?? []) {
        const contradiction: ContradictionRecord = {
          id: `contra-${project.contradictions.length + 1}`,
          addresses: conflict.addresses ?? [],
          issue: conflict.issue,
          conflictType: conflict.type || "cross_axis",
          materiality: conflict.blocking ? "blocking" : "non_blocking",
          openedBy: employee.id,
          openedAt: new Date().toISOString(),
          resolutionState: conflict.blocking ? "operator_decision_required" : "open",
          resolution: null,
          closedBy: null,
          closedAt: null,
        };
        project.contradictions.push(contradiction);
        run.contradictionIds.push(contradiction.id);
        for (const address of contradiction.addresses) {
          const slot = findSlot(project.grid, address);
          if (slot && !slot.contradictionIds.includes(contradiction.id)) slot.contradictionIds.push(contradiction.id);
        }
      }
    }
    emit({ type: "review", notes: run.reviewNotes });
  });

  await stage("gates", async () => {
    const turns = project.employeeTurns.filter((turn) => run.employeeTurnIds.includes(turn.id));
    const stops = semStopFlags(turns);
    const blockedSlots = coreGrid(project.grid).filter((slot) => slot.status === "BLOCKED");
    const blockingContradictions = project.contradictions.filter((item) => run.contradictionIds.includes(item.id) && item.materiality === "blocking" && item.resolutionState !== "resolved" && item.resolutionState !== "carried_explicitly");
    const sem = createGate(project, run, {
      gateType: "SEM",
      evaluatedAddresses: turns.flatMap((turn) => turn.semDeltas.map((delta) => delta.address)),
      evidenceRefs: run.employeeTurnIds,
      findings: [`${turns.length} bounded employee turns`, `${turns.reduce((sum, turn) => sum + turn.semDeltas.length, 0)} paired SEM deltas`],
      blockers: [...stops, ...blockedSlots.map((slot) => slot.address)],
      requiredActions: turns.flatMap((turn) => turn.semDeltas.map((delta) => delta.nextAction).filter((value): value is string => Boolean(value))),
      verdict: stops.length || blockedSlots.length ? "hold" : "pass",
      rerouteTarget: blockedSlots[0]?.address ?? null,
    });
    const segBlockers = [...blockingContradictions.map((item) => item.id), ...blockedSlots.map((slot) => slot.address)];
    const seg = createGate(project, run, {
      gateType: "SEG",
      evaluatedAddresses: coreGrid(project.grid).map((slot) => slot.address),
      evidenceRefs: [run.draftFreezeHash || "", sem.id],
      findings: ["200-address topology intact", "zero-skip disposition checked", "bounded employee ownership enforced"],
      blockers: segBlockers,
      requiredActions: blockingContradictions.map((item) => `Operator disposition required: ${item.id}`),
      verdict: segBlockers.length ? "hold" : "pass",
      rerouteTarget: blockingContradictions[0]?.addresses[0] || blockedSlots[0]?.address || null,
    });
    const gcard = createGate(project, run, {
      gateType: "G_CARD",
      evaluatedAddresses: project.gCards.filter((card) => run.gCardIds.includes(card.id)).flatMap((card) => card.addressPointers),
      evidenceRefs: run.gCardIds,
      findings: [`${run.gCardIds.length} address-bound G-Cards recorded`, "G-Card score intentionally not synthesized where no lawful score exists"],
      blockers: project.gCards.filter((card) => run.gCardIds.includes(card.id) && card.verdict === "HOLD").flatMap((card) => card.blockingFlags),
      requiredActions: project.gCards.filter((card) => run.gCardIds.includes(card.id)).flatMap((card) => card.requiredActions),
      verdict: project.gCards.some((card) => run.gCardIds.includes(card.id) && card.verdict === "HOLD") ? "hold" : project.gCards.some((card) => run.gCardIds.includes(card.id) && card.verdict === "CONDITIONAL") ? "conditional" : "pass",
      rerouteTarget: null,
    });
    const se20 = createGate(project, run, {
      gateType: "SE20",
      evaluatedAddresses: coreGrid(project.grid).map((slot) => slot.address),
      evidenceRefs: [],
      findings: ["SE20 versioned interface reserved; unrecovered legacy checklist relationships are not fabricated"],
      blockers: [],
      requiredActions: [],
      verdict: "conditional",
      rerouteTarget: null,
    });
    emit({ type: "gates", gates: [sem, seg, gcard, se20] });
  });

  await stage("red-pen-review", async () => {
    run.phase = "RED_PEN_REVIEW";
    const blocking = project.gates.filter((gate) => run.gateResultIds.includes(gate.id) && (gate.verdict === "hold" || gate.verdict === "fail"));
    const unresolved = project.contradictions.filter((item) => run.contradictionIds.includes(item.id) && item.materiality === "blocking" && item.resolutionState !== "resolved" && item.resolutionState !== "carried_explicitly");
    if (blocking.length || unresolved.length) {
      run.phase = "BLOCKED";
      throw new Error(`pre-lock governance blocked: ${[...blocking.map((gate) => gate.id), ...unresolved.map((item) => item.id)].join(", ")}`);
    }
    // Exact historical Q1-Q16 content remains unresolved. Do not invent it.
    appendChange(project, { address: "*", from: null, to: "red-pen interface reached", status: "OPERATIVE", provenance: "controller", note: "exact Q1-Q16 content unresolved; no questions fabricated" });
  });

  run.phase = "WAITING_HUMAN";
  run.stages.push({ name: "operator-lock", status: "waiting_human", note: "Only the operator may create the definitive Technical UST lock." });
  await save(project);
  emit({ type: "awaiting_lock", runId: run.id, draftFreezeHash: run.draftFreezeHash, defended: run.defended, reviewNotes: run.reviewNotes, gateIds: run.gateResultIds });
  return run;
}

export async function operatorLockAndDerive(project: Project, run: BuildRun, emit?: Emit): Promise<BuildRun> {
  const output = emit ?? (() => undefined);
  if (run.phase !== "WAITING_HUMAN") throw new Error(`run ${run.id} is not waiting for operator lock`);
  if (run.definitiveLockHash) throw new Error(`run ${run.id} is already definitively locked`);

  const blockingGates = project.gates.filter((gate) => run.gateResultIds.includes(gate.id) && (gate.verdict === "hold" || gate.verdict === "fail"));
  const blockingContradictions = project.contradictions.filter((item) => run.contradictionIds.includes(item.id) && item.materiality === "blocking" && item.resolutionState !== "resolved" && item.resolutionState !== "carried_explicitly");
  if (blockingGates.length || blockingContradictions.length) throw new Error("operator lock blocked by unresolved governance");

  const client = new Anthropic();
  const base = loadSoul() + loadStandards();
  const dossier = songDossier(project);
  const stage = stageRunner(project, run, output);

  await stage("definitive-lock", async () => {
    for (const slot of coreGrid(project.grid)) {
      if (slot.status === "BLOCKED") throw new Error(`cannot lock blocked address ${slot.address}`);
      slot.lockState = "DEFINITIVE_LOCKED";
      if (slot.value != null) slot.status = "LOCKED";
      slot.updatedAt = new Date().toISOString();
    }
    run.definitiveLockHash = seal(JSON.stringify(coreGrid(project.grid)));
    run.operatorLockAt = new Date().toISOString();
    run.phase = "DEFINITIVE_LOCK";
    appendChange(project, { address: "*", from: run.draftFreezeHash, to: run.definitiveLockHash, status: "LOCKED", provenance: "operator", note: `definitive Technical UST lock authorized by operator for ${run.id}` });
  });

  const foil = await stage("foil", async () => {
    if (!run.definitiveLockHash) throw new Error("FOIL requires definitive lock");
    run.phase = "FOIL_REVERSE_PASS";
    const raw = await ask(client, `${base}\n\nFOIL REVERSE PASS. The Technical UST is definitively locked. You may classify recurrence, promote recurring global traits, and deduplicate representation. You may not rewrite, resolve, or mutate locked song content. Return JSON only.`, `${dossier}\n\nLOCK: ${run.definitiveLockHash}\nLOCKED UST:\n${compactUST(project.grid)}\n\nReturn {"promoteShow":["..."],"promotePersona":["..."]}`, 1200);
    const parsed = parseJSON<{ promoteShow: string[]; promotePersona: string[] }>(raw);
    run.foil = { promoteShow: parsed?.promoteShow ?? [], promotePersona: parsed?.promotePersona ?? [] };
    output({ type: "foil", foil: run.foil });
    return run.foil;
  });

  let triad = await stage("surfaces", async () => {
    if (!run.definitiveLockHash) throw new Error("surface drafting requires definitive lock");
    run.phase = "SURFACE_REVIEW";
    const artistLyrics = project.messages.find((message) => message.role === "artist" && /\[LYRICS BLOCK\]/i.test(message.text))?.text ?? "";
    const raw = await ask(client, `${base}\n\nDERIVATIVE SURFACE DRAFTING. Draft all surfaces from the same definitive Technical UST lock. Artist-supplied lyric words are immutable unless explicit authorization to rewrite exists. Performance notation and spacing may surround those words without changing them. Return JSON only.`, `${dossier}\n\nDEFINITIVE LOCK: ${run.definitiveLockHash}\nLOCKED UST:\n${compactUST(project.grid)}\n\nFOIL SHOW: ${foil.promoteShow.join("; ")}\nFOIL PERSONA: ${foil.promotePersona.join("; ")}\nARTIST LYRICS:\n${artistLyrics.slice(0, 10000) || "(none)"}\n\nBudgets: creativeUst<=${BUDGETS.creativeUst}, showSummary<=${BUDGETS.showSummary}, personaProfile<=${BUDGETS.personaProfile}, personaStyleLine<=${BUDGETS.personaStyleLine}. Return {"creativeUst":"...","showSummary":"...","personaProfile":"...","personaStyleLine":"..."}`, 4800);
    const parsed = parseJSON<Triad>(raw);
    if (!parsed?.creativeUst || !parsed?.showSummary || !parsed?.personaProfile || !parsed?.personaStyleLine) throw new Error("derivative drafting returned incomplete surfaces");
    return parsed;
  });

  await stage("budgets", async () => {
    const over = [
      triad.creativeUst.length > BUDGETS.creativeUst && `creativeUst>${BUDGETS.creativeUst}`,
      triad.showSummary.length > BUDGETS.showSummary && `showSummary>${BUDGETS.showSummary}`,
      triad.personaProfile.length > BUDGETS.personaProfile && `personaProfile>${BUDGETS.personaProfile}`,
      triad.personaStyleLine.length > BUDGETS.personaStyleLine && `personaStyleLine>${BUDGETS.personaStyleLine}`,
    ].filter(Boolean) as string[];
    if (!over.length) return;
    const raw = await ask(client, `${base}\n\nLAWFUL DERIVATIVE COMPRESSION. Preserve the definitive lock, artist lyric words, local unique detail, and meaning. Reduce only derivative representation. Return the same four-field JSON.`, `Overages: ${over.join(", ")}\n\n${JSON.stringify(triad)}`, 4800);
    const parsed = parseJSON<Triad>(raw);
    if (parsed?.creativeUst) triad = parsed;
  });

  await stage("surface-freeze", async () => {
    run.triad = triad;
    run.surfaceFrozenAt = new Date().toISOString();
    run.phase = "SURFACE_FREEZE";
  });

  await stage("package", async () => {
    run.hash = seal(JSON.stringify({ lock: run.definitiveLockHash, triad: run.triad }));
    run.phase = "PACKAGED";
    run.accepted = true;
    appendChange(project, { address: "*", from: null, to: `package ${run.id}`, status: "OPERATIVE", provenance: "controller", note: `derivatives packaged from operator lock ${run.definitiveLockHash}` });
  });

  await save(project);
  output({ type: "done", runId: run.id, triad: run.triad, defended: run.defended, hash: run.hash, definitiveLockHash: run.definitiveLockHash });
  return run;
}
