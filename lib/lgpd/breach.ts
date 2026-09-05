export type BreachRisk = "none" | "low" | "high" | "unknown";
export type BreachDecision = "notify" | "not_notify" | "not_notifiable_documented" | "pending";
export const BREACH_WORKFLOW_V1 = process.env.BREACH_WORKFLOW_V1 === "true";
export function breachDeadline(knownAt: Date): Date { return new Date(knownAt.getTime() + 72 * 60 * 60 * 1000); }
export function requiresDataSubjectNotice(risk: BreachRisk): boolean { return risk === "high"; }
