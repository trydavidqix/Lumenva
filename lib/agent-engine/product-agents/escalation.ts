import type { AgentDefinition } from "../contracts/agent-os";
import type { HandoffIds } from "../agent/human-handoff";

export type EscalationPriority = "normal" | "high" | "urgent";

export interface EscalationDecision {
  kind: "human_escalation";
  reason: string;
  priority: EscalationPriority;
  requiredContext: readonly string[];
}

export type EscalationDecisionValidation =
  | { ok: true }
  | { ok: false; reason: "invalid_input" | "invalid_kind" | "invalid_reason" | "invalid_priority" | "invalid_required_context" };

const ESCALATION_PRIORITIES = new Set<string>(["normal", "high", "urgent"]);

export const ESCALATION_AGENT_DEFINITION = {
  id: "escalation",
  version: "1.0.0",
  objective: "Produce a structured handoff package for the CRM's existing human-handoff/case lifecycle.",
  autonomyLevel: "shadow",
  allowedSkills: [],
  allowedTools: [],
  loop: {
    goal: "Return one explicit human escalation package with required context.",
    maxSteps: 3,
    maxToolCalls: 1,
    maxTokens: 1_500,
    maxCostCents: 4,
    maxRuntimeMs: 10_000,
    repeatedToolLimit: 2,
    noProgressLimit: 2,
  },
  requiredModelCapabilities: ["structured_output"],
} as const satisfies AgentDefinition;

export function validateEscalationDecision(input: unknown): EscalationDecisionValidation {
  if (!input || typeof input !== "object") return { ok: false, reason: "invalid_input" };
  const candidate = input as Record<string, unknown>;
  if (candidate.kind !== "human_escalation") return { ok: false, reason: "invalid_kind" };
  if (typeof candidate.reason !== "string" || !candidate.reason.trim()) return { ok: false, reason: "invalid_reason" };
  if (typeof candidate.priority !== "string" || !ESCALATION_PRIORITIES.has(candidate.priority)) {
    return { ok: false, reason: "invalid_priority" };
  }
  if (
    !Array.isArray(candidate.requiredContext) ||
    !candidate.requiredContext.every((value) => typeof value === "string" && value.trim().length > 0)
  ) {
    return { ok: false, reason: "invalid_required_context" };
  }
  return { ok: true };
}

export interface CurrentHumanHandoffCommand {
  ids: HandoffIds;
  reason: string;
  conversationSummary: string;
  inboxTitle: string;
}

/**
 * Adapter only: it maps the Product Agent decision into the existing CRM
 * `performHumanHandoff` identity model. Execution remains a governed tool and
 * the agent never receives a database handle.
 */
export function buildCurrentHumanHandoffCommand(
  decision: EscalationDecision,
  ids: HandoffIds,
  conversationSummary: string,
): CurrentHumanHandoffCommand {
  return {
    ids,
    reason: decision.reason,
    conversationSummary,
    inboxTitle: decision.priority === "urgent" ? "Escalação urgente" : "Escalação para atendimento humano",
  };
}
