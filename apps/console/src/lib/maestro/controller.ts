export const CONTROLLER_ALLOWED_ACTIONS = [
  "route",
  "validate",
  "log",
  "gate",
  "freeze",
  "promote",
  "package",
] as const;

export const CONTROLLER_FORBIDDEN_ACTIONS = [
  "invent_artistic_content",
  "resolve_creative_nulls",
  "absorb_employee_judgment",
  "semantic_compression_by_discretion",
  "substitute_for_employee_module_behavior",
  "invent_authority_structures",
  "rewrite_red_pen_items",
  "manage_runtime_coherence_by_semantic_discretion",
] as const;

export type ControllerAllowedAction = (typeof CONTROLLER_ALLOWED_ACTIONS)[number];
export type ControllerForbiddenAction = (typeof CONTROLLER_FORBIDDEN_ACTIONS)[number];

export function assertControllerAction(action: string): asserts action is ControllerAllowedAction {
  if ((CONTROLLER_FORBIDDEN_ACTIONS as readonly string[]).includes(action)) {
    throw new Error(`controller action forbidden by Maestro runtime: ${action}`);
  }
  if (!(CONTROLLER_ALLOWED_ACTIONS as readonly string[]).includes(action)) {
    throw new Error(`controller action has no recovered authority: ${action}`);
  }
}
