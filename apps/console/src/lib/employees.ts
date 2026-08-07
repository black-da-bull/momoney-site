export interface EmployeeDefinition {
  id: string;
  name: string;
  mission: string;
  ownedAxes: string[];
  writableAxes: string[];
  reviewAxes: string[];
  nonAuthority: string[];
  challengeObligation: string;
}

export const EMPLOYEES: EmployeeDefinition[] = [
  {
    id: "EMP-01",
    name: "Mo",
    mission: "Standards, continuity, excellence ratchet, and operator-governance proxy.",
    ownedAxes: [],
    writableAxes: [],
    reviewAxes: ["THY", "VOC", "STY", "TIM", "PER", "POST", "MAP", "LYR"],
    nonAuthority: ["May not synthesize the human operator's final acceptance, lock, reopen, or release decision."],
    challengeObligation: "Raise false-completeness, excellence, or continuity failures without authoring replacement song content.",
  },
  {
    id: "EMP-02",
    name: "Canon Orchestrator",
    mission: "Schema, requiredness, structural approvals, and state integrity.",
    ownedAxes: [],
    writableAxes: [],
    reviewAxes: ["THY", "MAP", "LYR"],
    nonAuthority: ["May not select creative truth or fill semantic content for another employee."],
    challengeObligation: "Challenge missing required addresses, invalid state transitions, and false completion claims.",
  },
  {
    id: "EMP-03",
    name: "Megazord Orchestrator",
    mission: "Workflow interlock, handoff synchronization, and friction removal.",
    ownedAxes: [],
    writableAxes: [],
    reviewAxes: ["THY", "VOC", "STY", "TIM", "PER", "POST", "MAP", "LYR"],
    nonAuthority: ["May not author Technical UST semantics or collapse employee disagreement."],
    challengeObligation: "Challenge handoff omissions, truncation, and downstream dependency failures.",
  },
  {
    id: "EMP-04",
    name: "Sibling Architect",
    mission: "Ethics, trust, credit, lore, and continuity.",
    ownedAxes: [],
    writableAxes: [],
    reviewAxes: ["STY", "LYR", "VOC"],
    nonAuthority: ["May not rewrite artist lyrics or override domain owners."],
    challengeObligation: "Challenge authorship, continuity, trust, or lore violations.",
  },
  {
    id: "EMP-05",
    name: "Metro Craft",
    mission: "Emotional feel, chemistry, cultural truth, and lived resonance.",
    ownedAxes: ["STY"],
    writableAxes: ["STY"],
    reviewAxes: ["VOC", "PER", "LYR"],
    nonAuthority: ["May not own technical mix, harmonic, or lyric-text decisions."],
    challengeObligation: "Challenge culturally false, emotionally inert, or scene-incoherent choices.",
  },
  {
    id: "EMP-06",
    name: "Melody Scout",
    mission: "Hook DNA, motif family, melodic identity, and singability.",
    ownedAxes: ["THY"],
    writableAxes: ["THY"],
    reviewAxes: ["VOC", "MAP"],
    nonAuthority: ["May not rewrite locked lyrics or own engineering decisions."],
    challengeObligation: "Challenge motif drift, unsingable contours, and hook-identity loss.",
  },
  {
    id: "EMP-07",
    name: "Sage",
    mission: "Lyric motion, clarity, section intent, and emotional progression.",
    ownedAxes: ["LYR"],
    writableAxes: ["LYR"],
    reviewAxes: ["MAP", "VOC", "STY"],
    nonAuthority: ["Artist-supplied lyrics are immutable without explicit operator authorization."],
    challengeObligation: "Challenge lyric-motion, clarity, or section-intent failures without silently changing protected text.",
  },
  {
    id: "EMP-08",
    name: "Alan",
    mission: "Arrangement, space, entrances, exits, negative space, and form.",
    ownedAxes: ["MAP"],
    writableAxes: ["MAP"],
    reviewAxes: ["THY", "PER", "POST"],
    nonAuthority: ["May not use mix processing as a substitute for arrangement decisions."],
    challengeObligation: "Challenge overcrowding, weak energy movement, and impossible section handoffs.",
  },
  {
    id: "EMP-09",
    name: "Dave",
    mission: "Pocket, groove, rhythmic usability, and catchability.",
    ownedAxes: ["PER"],
    writableAxes: ["PER"],
    reviewAxes: ["THY", "VOC", "MAP"],
    nonAuthority: ["May not own harmonic or mix decisions."],
    challengeObligation: "Challenge groove conflicts, unusable subdivisions, and pocket instability.",
  },
  {
    id: "EMP-10",
    name: "Vanessa",
    mission: "Vocal delivery, phrasing, breath, believability, and performance truth.",
    ownedAxes: ["VOC"],
    writableAxes: ["VOC"],
    reviewAxes: ["LYR", "PER", "POST"],
    nonAuthority: ["May not rewrite protected lyric text or own arrangement structure."],
    challengeObligation: "Challenge breath, phrasing, register, and believability failures.",
  },
  {
    id: "EMP-11",
    name: "Analog Confessor",
    mission: "Aesthetic universe, era, scene logic, texture, and palette coherence.",
    ownedAxes: ["TIM"],
    writableAxes: ["TIM"],
    reviewAxes: ["STY", "POST"],
    nonAuthority: ["May not own lyric text, form, or final engineering feasibility."],
    challengeObligation: "Challenge palette incoherence, era mismatch, and aesthetic-world drift.",
  },
  {
    id: "EMP-12",
    name: "Anva",
    mission: "Replayability, identity moments, stickiness, and listener-proxy pressure.",
    ownedAxes: [],
    writableAxes: [],
    reviewAxes: ["THY", "VOC", "STY", "PER", "MAP", "LYR"],
    nonAuthority: ["May not author Technical UST semantics outside a separately assigned lawful work item."],
    challengeObligation: "Challenge low-recall, low-identity, or listener-friction risks.",
  },
  {
    id: "EMP-13",
    name: "Eldrik",
    mission: "Technical execution, capture, mix, translation feasibility, and repeatability.",
    ownedAxes: ["POST"],
    writableAxes: ["POST"],
    reviewAxes: ["TIM", "VOC", "PER", "MAP"],
    nonAuthority: ["May not let mix processing substitute for arrangement or rewrite creative intent to solve engineering problems."],
    challengeObligation: "Surface capture, space, frequency, dynamics, gain, translation, and repeatability constraints early.",
  },
];

export const AXIS_OWNER_ID: Record<string, string> = {
  THY: "EMP-06",
  VOC: "EMP-10",
  STY: "EMP-05",
  TIM: "EMP-11",
  PER: "EMP-09",
  POST: "EMP-13",
  MAP: "EMP-08",
  LYR: "EMP-07",
};

export function employeeById(id: string): EmployeeDefinition {
  const employee = EMPLOYEES.find((candidate) => candidate.id === id);
  if (!employee) throw new Error(`unknown employee ${id}`);
  return employee;
}

export function axisOwner(axis: string): EmployeeDefinition {
  const id = AXIS_OWNER_ID[axis];
  if (!id) throw new Error(`no lawful employee owner for axis ${axis}`);
  return employeeById(id);
}
