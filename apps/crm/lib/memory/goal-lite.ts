export type GoalHealth = "ON_TRACK" | "AT_RISK" | "BLOCKED" | "BUDGET_LIMITED" | "COMPLETE";
export type GoalStatus = "DRAFT" | "AUTHORIZED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
export type GoalLite = { goal_id:string; organization_id:string; owner_id:string; title:string; objective:string; success_criteria:string[]; constraints:string[]; allowed_actions:string[]; forbidden_actions:string[]; risk_ceiling:`R${0|1|2|3|4}`; autonomy_ceiling:`A${0|1|2|3|4|5}`; health:GoalHealth; status:GoalStatus; evidence_refs:string[] };
export function validateGoalLite(goal: GoalLite): void {
  if (!goal.goal_id.trim() || !goal.organization_id.trim() || !goal.owner_id.trim() || !goal.title.trim() || !goal.objective.trim()) throw new Error("goal_required");
  if (goal.success_criteria.length === 0 || goal.allowed_actions.some((a)=>goal.forbidden_actions.includes(a))) throw new Error("goal_constraints_invalid");
  if (goal.health === "COMPLETE" && (goal.status !== "COMPLETED" || goal.evidence_refs.length === 0)) throw new Error("goal_completion_evidence_required");
}
