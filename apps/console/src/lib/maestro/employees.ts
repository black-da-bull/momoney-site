import type { AxisId } from "./types";

export interface EmployeeModule {
  id: string;
  name: string;
  identity: string | null;
  fiveElements: {
    role: string | null;
    expertise: string | null;
    process: string | null;
    output: string | null;
    constraints: string | null;
  };
  mission: string | null;
  domainAuthority: {
    ownsDomains: string[];
    mayDecide: string[];
    mayWrite: string[];
    mayRaiseBlockingObjection: string[];
    mayTriggerGateReview: string[];
  };
  explicitNonAuthority: string[];
  ownedDecisions: string[];
  blockedDecisions: string[];
  upstreamInputs: string[];
  downstreamOutputs: string[];
  readableZones: string[];
  writableZones: string[];
  conditioning: string[];
  evaluationFacets: string[];
  nullClassesHandled: string[];
  escalationTargets: string[];
  challengeObligations: string[];
  conflictPrecedence: string[];
  failureModes: string[];
  reversePassParticipation: string[];
  notesAndArtifactObligations: string[];
  controllerSubstitutionProhibitions: string[];
  songExcellenceReferenceDuties: string[];
  executiveCommitteeEligibility: boolean | null;
  recoveryStatus: "RECOVERED" | "RECOVERY_REQUIRED";
}

export const MAESTRO_EMPLOYEE_NAMES = [
  "Mo",
  "Canon Orchestrator",
  "Megazord Orchestrator",
  "Sibling Architect",
  "Metro Craft",
  "Melody Scout",
  "Sage",
  "Alan",
  "Dave",
  "Vanessa",
  "Analog Confessor",
  "Anva",
  "Eldrik",
] as const;

function unresolvedEmployee(index: number, name: (typeof MAESTRO_EMPLOYEE_NAMES)[number]): EmployeeModule {
  return {
    id: `EMP-${String(index + 1).padStart(2, "0")}`,
    name,
    identity: null,
    fiveElements: { role: null, expertise: null, process: null, output: null, constraints: null },
    mission: null,
    domainAuthority: { ownsDomains: [], mayDecide: [], mayWrite: [], mayRaiseBlockingObjection: [], mayTriggerGateReview: [] },
    explicitNonAuthority: [],
    ownedDecisions: [],
    blockedDecisions: [],
    upstreamInputs: [],
    downstreamOutputs: [],
    readableZones: [],
    writableZones: [],
    conditioning: [],
    evaluationFacets: [],
    nullClassesHandled: [],
    escalationTargets: [],
    challengeObligations: [],
    conflictPrecedence: [],
    failureModes: [],
    reversePassParticipation: [],
    notesAndArtifactObligations: [],
    controllerSubstitutionProhibitions: [],
    songExcellenceReferenceDuties: [],
    executiveCommitteeEligibility: null,
    recoveryStatus: "RECOVERY_REQUIRED",
  };
}

export const EMPLOYEE_REGISTRY: EmployeeModule[] = MAESTRO_EMPLOYEE_NAMES.map(unresolvedEmployee);

export function executableEmployees(): EmployeeModule[] {
  return EMPLOYEE_REGISTRY.filter((employee) => employee.recoveryStatus === "RECOVERED");
}

export function unresolvedEmployees(): EmployeeModule[] {
  return EMPLOYEE_REGISTRY.filter((employee) => employee.recoveryStatus === "RECOVERY_REQUIRED");
}

export function assertEmployeeCanWrite(employee: EmployeeModule, axis: AxisId): void {
  if (employee.recoveryStatus !== "RECOVERED") {
    throw new Error(`${employee.name} cannot execute: employee contract recovery is incomplete`);
  }
  if (!employee.writableZones.includes(axis) && !employee.domainAuthority.mayWrite.includes(axis)) {
    throw new Error(`${employee.name} has no recovered write authority for ${axis}`);
  }
}
