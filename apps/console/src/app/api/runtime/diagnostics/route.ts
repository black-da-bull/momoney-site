import { NextResponse } from "next/server";
import { MAESTRO_SCHEMA_VERSION } from "@/lib/maestro/types";
import { TECHNICAL_UST, createNullTechnicalUst, validateTechnicalUstTopology } from "@/lib/maestro/topology";
import { SEM_CRITERIA, SEM_RELEASE_FLOOR, validateSemRegistry } from "@/lib/maestro/sem";
import { CONTROLLER_ALLOWED_ACTIONS, CONTROLLER_FORBIDDEN_ACTIONS } from "@/lib/maestro/controller";
import { EMPLOYEE_REGISTRY, executableEmployees, unresolvedEmployees } from "@/lib/maestro/employees";
import { FOIL_ALGORITHM_STATUS } from "@/lib/maestro/foil";
import { UNRESOLVED_GOVERNANCE } from "@/lib/maestro/governance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const topology = validateTechnicalUstTopology();
  const sem = validateSemRegistry();
  const invariants = [...topology, ...sem];
  const atoms = createNullTechnicalUst();
  const keyCount = TECHNICAL_UST.reduce((sum, axis) => sum + axis.keys.length, 0);
  const executable = executableEmployees();
  const unresolved = unresolvedEmployees();

  return NextResponse.json({
    runtime: "maestro",
    schemaVersion: MAESTRO_SCHEMA_VERSION,
    status: invariants.every((item) => item.pass) ? "KERNEL_VALID_STAFF_RECOVERY_REQUIRED" : "INVALID",
    topology: {
      axes: TECHNICAL_UST.map((axis) => axis.id),
      axisCount: TECHNICAL_UST.length,
      keyCount,
      leafCount: atoms.length,
      nullCount: atoms.filter((atom) => atom.state === "NULL").length,
    },
    governance: {
      semCriteria: SEM_CRITERIA.length,
      semReleaseFloor: SEM_RELEASE_FLOOR,
      seg: "governance_umbrella",
      gCard: "distinct_output",
      se20: "distinct_check_mapping_unresolved",
      hpa: "distinct_post_render_check_aggregate_unresolved",
      redPen: "final_pre_lock_whole_draft_review",
      q1q16: "reserved_unresolved_do_not_invent",
      unresolved: UNRESOLVED_GOVERNANCE,
    },
    controller: {
      allowed: CONTROLLER_ALLOWED_ACTIONS,
      forbidden: CONTROLLER_FORBIDDEN_ACTIONS,
    },
    employees: {
      rosterCount: EMPLOYEE_REGISTRY.length,
      executableCount: executable.length,
      recoveryRequiredCount: unresolved.length,
      recoveryRequired: unresolved.map((employee) => employee.name),
    },
    foil: {
      algorithmStatus: FOIL_ALGORITHM_STATUS,
    },
    invariants,
  });
}
