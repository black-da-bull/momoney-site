import crypto from "node:crypto";
import { TECHNICAL_UST } from "./topology";
import { SEM_CRITERIA, SEM_RELEASE_FLOOR, calculateSemComposite } from "./sem";
import { db, getDbProject, updateDbProject, appendDbDialogue, nextDialogueSequence, createRun, updateRun } from "./db";
import type { DialogueKind } from "./persistence";
import type { ProjectSnapshot, } from "./state";

export type Emit = (event: Record<string, unknown>) => void;

const STAFF = [
  ["Mo", "standards", "integrity, continuity, excellence baseline"],
  ["Canon Orchestrator", "structure", "role boundaries, approvals, structural state"],
  ["Megazord Orchestrator", "workflow", "sequencing and role synchronization"],
  ["Sibling Architect", "ethics and lore", "trust, credit fairness, motif and world continuity"],
  ["Metro Craft", "emotion", "feel, culture, chemistry and emotional pressure"],
  ["Melody Scout", "melody", "hook DNA and motif families"],
  ["Sage", "lyrics", "lyric motion, emotional plot and clarity"],
  ["Alan", "arrangement", "space, entrances, exits and section architecture"],
  ["Dave", "pocket", "groove and rhythmic usability"],
  ["Vanessa", "performance", "believability, tone, breath, intensity and phrasing"],
  ["Analog Confessor", "aesthetic world", "moral temperature, scene logic and sonic world"],
  ["Anva", "replayability", "listener identity and replay judgment"],
  ["Eldrik", "engineering", "feasibility, capture, mix and repeatability"],
] as const;

const AXIS_OWNER: Record<string, string> = {
  THY: "Melody Scout",
  VOC: "Vanessa",
  STY: "Metro Craft",
  TIM: "Analog Confessor",
  PER: "Dave",
  POST: "Eldrik",
  LYR: "Sage",
};

const AXIS_REVIEWERS: Record<string, string[]> = {
  THY: ["Dave", "Alan", "Anva"],
  VOC: ["Sage", "Dave", "Eldrik"],
  STY: ["Analog Confessor", "Sibling Architect", "Anva"],
  TIM: ["Eldrik", "Metro Craft", "Alan"],
  PER: ["Alan", "Vanessa", "Eldrik"],
  POST: ["Analog Confessor", "Vanessa", "Alan"],
  LYR: ["Vanessa", "Metro Craft", "Sibling Architect"],
};

function employee(name: string) {
  const found = STAFF.find((row) => row[0] === name);
  if (!found) throw new Error(`unknown employee ${name}`);
  return { name: found[0], domain: found[1], function: found[2] };
}

function hash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function openAiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured for this Preview deployment.");
  return key;
}

async function jsonModel(system: string, user: string): Promise<any> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openAiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || process.env.MAESTRO_MODEL || "gpt-5-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "developer", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${await response.text()}`);
  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("OpenAI returned no JSON content");
  return JSON.parse(content);
}

async function speak(projectId: string, speakerId: string, text: string, kind: DialogueKind, addresses: string[] = []) {
  const sequence = await nextDialogueSequence(projectId);
  await appendDbDialogue({
    id: `dlg-${projectId}-${sequence}`,
    projectId,
    sequence,
    kind,
    speakerId,
    speakerType: speakerId === "operator" ? "HUMAN" : speakerId === "controller" ? "SYSTEM" : "EMPLOYEE",
    text,
    targetAddresses: addresses,
    evidenceRefs: [],
    createdAt: new Date().toISOString(),
  });
}

async function persistEvent(projectId: string, sequence: number, payload: Record<string, unknown>) {
  const eventId = `evt-${projectId}-${sequence}`;
  await db().query(
    `INSERT INTO maestro_v02_events(project_id,sequence,event_id,idempotency_key,payload)
     VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING`,
    [projectId, sequence, eventId, eventId, JSON.stringify(payload)],
  );
}

function compactUst(snapshot: ProjectSnapshot) {
  return snapshot.technicalUst.map((a) => ({ address: a.address, label: `${a.keyName}.${a.subkeyName}`, value: a.value, state: a.state }));
}

async function fillAxis(projectId: string, snapshot: ProjectSnapshot, axisId: string, seed: string, emit: Emit) {
  const owner = employee(AXIS_OWNER[axisId]);
  const targets = snapshot.technicalUst.filter((a) => a.axis === axisId);
  emit({ type: "stage", name: `axis:${axisId}`, status: "running", employee: owner.name });
  const result = await jsonModel(
    `You are ${owner.name}, the Maestro employee who owns ${owner.domain}. Your core function is ${owner.function}.
You are a bounded SME, not the controller. Work only inside your lawful domain. Technical UST is canonical. NULL is a reserved address: every assigned address must be filled or explicitly preserved null with a reason. Never silently skip an address. Artist-supplied quoted lyrics may not be rewritten. Song Excellence is concurrent pressure, not a terminal scorecard.
Return JSON only: {"speech":"...","fills":[{"address":"...","value":any|null,"rationale":"..."}],"sem":[{"criterionId":"S1","score":0-5,"finding":"..."}]}.`,
    `ARTIST INPUT:\n${seed}\n\nASSIGNED ADDRESSES:\n${JSON.stringify(targets.map((a) => ({ address: a.address, field: a.subkeyName })))}\n\nSEM CRITERIA:\n${JSON.stringify(SEM_CRITERIA)}\nFill every assigned address exactly once.`,
  );
  await speak(projectId, owner.name, String(result.speech || `${owner.name} completed ${axisId}.`), "EMPLOYEE_UTTERANCE", targets.map((a) => a.address));
  const fills = Array.isArray(result.fills) ? result.fills : [];
  const byAddress = new Map(fills.map((f: any) => [String(f.address), f]));
  for (const atom of targets) {
    const fill: any = byAddress.get(atom.address);
    atom.value = fill ? fill.value ?? null : null;
    atom.state = "RESOLVED";
    atom.resolution = atom.value == null ? "EXPLICIT_NONE" : "VALUE";
    atom.ownerId = owner.name;
    atom.reviewerIds = AXIS_REVIEWERS[axisId] ?? [];
    atom.evidenceRefs = [`run:${owner.name}`, fill?.rationale ? `reason:${fill.rationale}` : "reason:explicit-null"];
    atom.revision += 1;
    snapshot.sequence += 1;
    snapshot.stateVersion += 1;
    await persistEvent(projectId, snapshot.sequence, { command: "RESOLVE", actor: owner.name, address: atom.address, value: atom.value, rationale: fill?.rationale ?? "explicit null" });
  }
  emit({ type: "stage", name: `axis:${axisId}`, status: "done", employee: owner.name });
  return Array.isArray(result.sem) ? result.sem : [];
}

async function pressureTurn(projectId: string, snapshot: ProjectSnapshot, staffName: string, seed: string, emit: Emit) {
  const person = employee(staffName);
  emit({ type: "pressure", employee: staffName, status: "running" });
  const result = await jsonModel(
    `You are ${person.name}, a bounded Maestro employee. Domain: ${person.domain}. Core function: ${person.function}.
Review the shared Technical UST from your lane. Contradiction is first-class. Challenge only material issues you can defend. Do not seize another domain. Return JSON only: {"speech":"...","challenges":[{"address":"AXIS.Kn.Sn","severity":"observe|warn|challenge|block","issue":"...","recommendation":"..."}],"scores":{"S1":0-5,...,"S12":0-5}}.`,
    `ARTIST INPUT:\n${seed}\n\nCURRENT TECHNICAL UST:\n${JSON.stringify(compactUst(snapshot))}\n\nSEM:\n${JSON.stringify(SEM_CRITERIA)}`,
  );
  const challenges = Array.isArray(result.challenges) ? result.challenges : [];
  await speak(projectId, person.name, String(result.speech || `${person.name} reviewed the room.`), challenges.length ? "CHALLENGE" : "EMPLOYEE_UTTERANCE", challenges.map((c: any) => String(c.address)));
  emit({ type: "pressure", employee: staffName, status: "done", challenges: challenges.length });
  return { challenges, scores: result.scores || {} };
}

async function reviseAddresses(projectId: string, snapshot: ProjectSnapshot, axisId: string, challenges: any[], seed: string, emit: Emit) {
  const owner = employee(AXIS_OWNER[axisId]);
  const addresses = Array.from(new Set(challenges.map((c) => String(c.address))));
  if (!addresses.length) return;
  const atoms = snapshot.technicalUst.filter((a) => addresses.includes(a.address));
  const result = await jsonModel(
    `You are ${owner.name}, lawful owner for ${owner.domain}. Peer challenges have been routed back to you. Defend, revise, or explicitly preserve each challenged address. Do not modify artist-supplied quoted lyric text. Return JSON only: {"speech":"...","revisions":[{"address":"...","value":any|null,"rationale":"..."}]}.`,
    `ARTIST INPUT:\n${seed}\n\nCHALLENGES:\n${JSON.stringify(challenges)}\n\nCURRENT ADDRESSES:\n${JSON.stringify(atoms.map((a) => ({ address:a.address,value:a.value,label:a.subkeyName})))}`,
  );
  await speak(projectId, owner.name, String(result.speech || `${owner.name} answered the challenge.`), "REVISION", addresses);
  const revisions = new Map((Array.isArray(result.revisions) ? result.revisions : []).map((r: any) => [String(r.address), r]));
  for (const atom of atoms) {
    const revision: any = revisions.get(atom.address);
    if (!revision) continue;
    atom.value = revision.value ?? null;
    atom.resolution = atom.value == null ? "EXPLICIT_NONE" : "VALUE";
    atom.state = "RESOLVED";
    atom.revision += 1;
    snapshot.sequence += 1;
    snapshot.stateVersion += 1;
    await persistEvent(projectId, snapshot.sequence, { command: "RESOLVE", actor: owner.name, address: atom.address, value: atom.value, rationale: revision.rationale });
  }
  emit({ type: "revision", employee: owner.name, addresses });
}

function aggregateScores(all: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const criterion of SEM_CRITERIA) {
    const values = all.map((s) => Number(s[criterion.id])).filter((v) => Number.isFinite(v) && v >= 0 && v <= 5);
    out[criterion.id] = values.length ? values.reduce((a,b)=>a+b,0) / values.length : 0;
  }
  return out;
}

async function generateSurfaces(snapshot: ProjectSnapshot, seed: string) {
  const locked = JSON.stringify(compactUst(snapshot));
  const common = `Artist input:\n${seed}\n\nDEFINITIVE LOCKED TECHNICAL UST:\n${locked}\nDo not mutate the locked center. Artist-supplied quoted lyric text is immutable.`;
  const [creative, summary, persona] = await Promise.all([
    jsonModel(`Compile the locked Maestro Technical UST into the Creative UST Suno lyrics-prompt surface. Mandatory order: [Theory] [Voices] [Style] [Timbre] [Performance] [Post-Production] then ▸ LYRICS BLOCK. Preserve exact supplied lyrics. Return JSON {"text":"..."}.`, common),
    jsonModel(`Compile the locked Maestro Technical UST into a concise Show Summary style/production surface, approximately 1000 characters. Return JSON {"text":"..."}.`, common),
    jsonModel(`Compile the locked Maestro Technical UST into A/R persona surfaces. Return JSON {"styleLine":"<=150 chars","profile":"approximately 2000 chars"}.`, common),
  ]);
  return { creativeUst: String(creative.text || ""), showSummary: String(summary.text || ""), personaStyleLine: String(persona.styleLine || ""), personaProfile: String(persona.profile || "") };
}

export async function runMaestroEndToEnd(projectId: string, emit: Emit) {
  const project = await getDbProject(projectId);
  if (!project) throw new Error("unknown project");
  const seed = project.seedRaw;
  if (!seed?.trim()) throw new Error("Add the song concept/specification/lyrics before BUILD.");
  const snapshot = structuredClone(project.snapshot) as ProjectSnapshot;
  const runId = await createRun(projectId);
  const transcript: any[] = [];
  try {
    snapshot.phase = "AXIS_FILL";
    emit({ type: "stage", name: "intake", status: "done" });
    const semDeltas: any[] = [];
    for (const axis of TECHNICAL_UST) semDeltas.push(...await fillAxis(projectId, snapshot, axis.id, seed, emit));
    snapshot.phase = "DRAFT_FREEZE";
    await speak(projectId, "controller", "Draft freeze applied. All Technical UST addresses have a lawful disposition; pressure room opens.", "SYSTEM_NOTE");
    emit({ type: "stage", name: "draft-freeze", status: "done" });

    let finalScores: Record<string, number> = {};
    let blocking: any[] = [];
    for (let round = 1; round <= 5; round += 1) {
      snapshot.phase = "ROUND_ROBIN";
      emit({ type: "stage", name: `round-robin:${round}`, status: "running" });
      const turns = [] as any[];
      for (const row of STAFF) turns.push(await pressureTurn(projectId, snapshot, row[0], seed, emit));
      const scores = turns.map((t) => t.scores);
      finalScores = aggregateScores(scores);
      blocking = turns.flatMap((t) => t.challenges).filter((c:any) => c.severity === "block" || c.severity === "challenge");
      transcript.push({ round, turns, composite: calculateSemComposite(finalScores) });
      if (!blocking.length && calculateSemComposite(finalScores) >= SEM_RELEASE_FLOOR) {
        emit({ type: "stage", name: `round-robin:${round}`, status: "done", converged: true });
        break;
      }
      const byAxis = new Map<string, any[]>();
      for (const challenge of blocking) {
        const axis = String(challenge.address || "").split(".")[0];
        if (!AXIS_OWNER[axis]) continue;
        byAxis.set(axis, [...(byAxis.get(axis) || []), challenge]);
      }
      for (const [axis, challenges] of Array.from(byAxis.entries())) await reviseAddresses(projectId, snapshot, axis, challenges, seed, emit);
      emit({ type: "stage", name: `round-robin:${round}`, status: "done", converged: false });
    }

    snapshot.phase = "RED_PEN";
    const composite = calculateSemComposite(finalScores);
    const undispositioned = snapshot.technicalUst.filter((a) => a.state !== "RESOLVED");
    const redPen = {
      implementation: "known-invariants-red-pen-v0.2",
      historicalQ1Q16: "UNRESOLVED_NOT_FABRICATED",
      composite,
      releaseFloor: SEM_RELEASE_FLOOR,
      blockingChallenges: blocking,
      undispositioned: undispositioned.map((a) => a.address),
      pass: !blocking.length && !undispositioned.length && composite >= SEM_RELEASE_FLOOR,
    };
    await speak(projectId, "controller", `Red-pen review: ${redPen.pass ? "clean" : "blocked"}. SEM ${composite.toFixed(2)}/${SEM_RELEASE_FLOOR}. Historical Q1-Q16 remains unresolved and is not fabricated.`, "RED_PEN");
    emit({ type: "stage", name: "red-pen", status: redPen.pass ? "done" : "failed", redPen });
    if (!redPen.pass) {
      await updateRun(runId, { status: "BLOCKED", completedAt: new Date().toISOString(), transcript, semState: finalScores, redPen });
      await updateDbProject(projectId, { phase: "RED_PEN", snapshot });
      return { runId, status: "BLOCKED", redPen };
    }

    snapshot.phase = "LOCK_ELIGIBLE";
    const lockHash = hash(snapshot.technicalUst.map((a) => [a.address,a.value,a.revision]));
    for (const atom of snapshot.technicalUst) { atom.state = "LOCKED"; atom.lockedSha256 = lockHash; }
    snapshot.phase = "DEFINITIVE_LOCK";
    snapshot.definitiveLockHash = lockHash;
    await speak(projectId, "controller", `Definitive Technical UST LOCK emitted: ${lockHash.slice(0,12)}.`, "DECISION");
    emit({ type: "stage", name: "definitive-lock", status: "done", hash: lockHash });

    snapshot.phase = "FOIL";
    const foil = { lockedHash: lockHash, policy: "promotion-and-dedup-only", preservedLeafAddresses: snapshot.technicalUst.map((a) => a.address) };
    emit({ type: "stage", name: "foil", status: "done" });

    snapshot.phase = "SURFACE_BUILD";
    emit({ type: "stage", name: "surfaces", status: "running" });
    const surfaces = await generateSurfaces(snapshot, seed);
    snapshot.phase = "SURFACE_FREEZE";
    const packageHash = hash({ lockHash, surfaces });
    snapshot.phase = "PACKAGE";
    await updateDbProject(projectId, { phase: "PACKAGE", snapshot, definitiveLockHash: lockHash, surfaces, packagedAt: new Date().toISOString() });
    await updateRun(runId, { status: "COMPLETE", completedAt: new Date().toISOString(), transcript, semState: finalScores, redPen, foil, surfaces });
    emit({ type: "stage", name: "surfaces", status: "done" });
    emit({ type: "stage", name: "package", status: "done", hash: packageHash });
    emit({ type: "done", runId, status: "COMPLETE", lockHash, packageHash, surfaces, semComposite: composite });
    return { runId, status: "COMPLETE", surfaces, lockHash, packageHash };
  } catch (error) {
    await updateRun(runId, { status: "FAILED", completedAt: new Date().toISOString(), transcript, error: error instanceof Error ? error.message : "runtime failure" });
    throw error;
  }
}
