export const AGENT_RUN_STATUSES = [
  "running",
  "waiting_approval",
  "completed",
  "blocked",
  "retryable_failure",
  "permanent_failure",
  "budget_exhausted",
  "policy_denied",
  "cancelled",
] as const;

export type AgentRunStatus = (typeof AGENT_RUN_STATUSES)[number];

export const TERMINAL_AGENT_RUN_STATUSES = [
  "completed",
  "blocked",
  "permanent_failure",
  "budget_exhausted",
  "policy_denied",
  "cancelled",
] as const satisfies readonly AgentRunStatus[];

export type TerminalAgentRunStatus = (typeof TERMINAL_AGENT_RUN_STATUSES)[number];

const TERMINAL_STATUS_SET = new Set<AgentRunStatus>(TERMINAL_AGENT_RUN_STATUSES);

export function isTerminalAgentRunStatus(status: AgentRunStatus): status is TerminalAgentRunStatus {
  return TERMINAL_STATUS_SET.has(status);
}

const ALLOWED_AGENT_RUN_TRANSITIONS: Readonly<Record<AgentRunStatus, readonly AgentRunStatus[]>> = {
  running: [
    "waiting_approval",
    "completed",
    "blocked",
    "retryable_failure",
    "permanent_failure",
    "budget_exhausted",
    "policy_denied",
    "cancelled",
  ],
  waiting_approval: ["running", "blocked", "permanent_failure", "policy_denied", "cancelled"],
  retryable_failure: ["running", "permanent_failure", "cancelled"],
  completed: [],
  blocked: [],
  permanent_failure: [],
  budget_exhausted: [],
  policy_denied: [],
  cancelled: [],
};

export function isAgentRunTransitionAllowed(from: AgentRunStatus, to: AgentRunStatus): boolean {
  return ALLOWED_AGENT_RUN_TRANSITIONS[from].includes(to);
}

export const AGENT_AUTONOMY_LEVELS = [
  "off",
  "shadow",
  "draft",
  "assisted",
  "autopilot_low_risk",
  "autopilot_expanded",
] as const;

export type AgentAutonomyLevel = (typeof AGENT_AUTONOMY_LEVELS)[number];

export interface AgentLoopSpec {
  goal: string;
  maxSteps: number;
  maxToolCalls: number;
  maxTokens: number;
  maxCostCents: number;
  maxRuntimeMs: number;
  repeatedToolLimit: number;
  noProgressLimit: number;
}

export interface AgentLoopUsage {
  steps: number;
  toolCalls: number;
  tokensUsed: number;
  costCents: number;
  runtimeMs: number;
}

export type LoopBudgetStopReason =
  | "max_steps_exhausted"
  | "max_tool_calls_exhausted"
  | "max_tokens_exhausted"
  | "max_cost_exhausted"
  | "max_runtime_exhausted";

export type LoopBudgetDecision = { kind: "continue" } | { kind: "stop"; reason: LoopBudgetStopReason };

export function evaluateLoopBudget(spec: AgentLoopSpec, usage: AgentLoopUsage): LoopBudgetDecision {
  if (usage.steps >= spec.maxSteps) return { kind: "stop", reason: "max_steps_exhausted" };
  if (usage.toolCalls >= spec.maxToolCalls) return { kind: "stop", reason: "max_tool_calls_exhausted" };
  if (usage.tokensUsed >= spec.maxTokens) return { kind: "stop", reason: "max_tokens_exhausted" };
  if (usage.costCents >= spec.maxCostCents) return { kind: "stop", reason: "max_cost_exhausted" };
  if (usage.runtimeMs >= spec.maxRuntimeMs) return { kind: "stop", reason: "max_runtime_exhausted" };
  return { kind: "continue" };
}

export interface ToolInvocationFingerprintInput {
  tool: string;
  args: unknown;
}

export type LoopProgressDecision =
  | { kind: "continue" }
  | { kind: "stop"; reason: "repeated_tool_exhausted" | "no_progress_exhausted" };

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableNormalize);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, stableNormalize(entryValue)]),
    );
  }

  return value;
}

function toolInvocationFingerprint(invocation: ToolInvocationFingerprintInput): string {
  return `${invocation.tool}:${JSON.stringify(stableNormalize(invocation.args))}`;
}

export function evaluateRepeatedTool(
  spec: AgentLoopSpec,
  history: readonly ToolInvocationFingerprintInput[],
): LoopProgressDecision {
  if (history.length < spec.repeatedToolLimit) return { kind: "continue" };

  const recent = history.slice(-spec.repeatedToolLimit).map(toolInvocationFingerprint);
  const [first, ...rest] = recent;
  if (first !== undefined && rest.every((fingerprint) => fingerprint === first)) {
    return { kind: "stop", reason: "repeated_tool_exhausted" };
  }

  return { kind: "continue" };
}

export function evaluateNoProgress(
  spec: AgentLoopSpec,
  progressFingerprints: readonly string[],
): LoopProgressDecision {
  if (progressFingerprints.length < spec.noProgressLimit) return { kind: "continue" };

  const recent = progressFingerprints.slice(-spec.noProgressLimit);
  const [first, ...rest] = recent;
  if (first !== undefined && rest.every((fingerprint) => fingerprint === first)) {
    return { kind: "stop", reason: "no_progress_exhausted" };
  }

  return { kind: "continue" };
}

export interface AgentDefinition {
  id: string;
  version: string;
  objective: string;
  autonomyLevel: AgentAutonomyLevel;
  allowedSkills: readonly string[];
  allowedTools: readonly string[];
  loop: AgentLoopSpec;
  requiredModelCapabilities: readonly string[];
}

export interface AgentRunIdentity {
  runId: string;
  organizationId: string;
  agentId: string;
  agentVersion: string;
  triggerEventId?: string;
  traceId: string;
  correlationId: string;
}

export interface AgentRunSnapshot extends AgentRunIdentity {
  status: AgentRunStatus;
  steps: number;
  toolCalls: number;
  tokensUsed: number;
  costCents: number;
  stopReason?: string;
}

export type PolicyDecision =
  | { kind: "allow" }
  | { kind: "deny"; reason: string }
  | { kind: "require_approval"; reason: string; approvalType: string };

export const TOOL_RISK_LEVELS = [
  "r0_read",
  "r1_reversible_write",
  "r2_external_communication",
  "r3_sensitive_commercial",
  "r4_destructive_admin",
] as const;

export type ToolRiskLevel = (typeof TOOL_RISK_LEVELS)[number];

/**
 * Contract-level eligibility only. R0-R3 still require tenant/capability/policy
 * checks. R4 is structurally excluded from autonomous execution at every level.
 */
export function isAutonomyEligibleRisk(risk: ToolRiskLevel): boolean {
  return risk !== "r4_destructive_admin";
}

export interface ToolDefinitionContract {
  id: string;
  risk: ToolRiskLevel;
  hasSideEffect: boolean;
  idempotencyRequired: boolean;
  timeoutMs: number;
  maxRetries: number;
}

export interface ToolFailureInput {
  failureCount: number;
  retryable: boolean;
}

export type ToolFailureDecision =
  | { kind: "retry"; reason: "tool_retryable_failure" }
  | { kind: "stop"; reason: "tool_retry_exhausted" | "tool_permanent_failure" };

export function evaluateToolFailure(
  tool: ToolDefinitionContract,
  failure: ToolFailureInput,
): ToolFailureDecision {
  if (!failure.retryable) return { kind: "stop", reason: "tool_permanent_failure" };
  if (failure.failureCount > tool.maxRetries) return { kind: "stop", reason: "tool_retry_exhausted" };
  return { kind: "retry", reason: "tool_retryable_failure" };
}

export interface ToolIdempotencyIdentity {
  runId: string;
  stepId: string;
  tool: string;
  businessTarget: unknown;
}

export function deriveToolIdempotencyKey(identity: ToolIdempotencyIdentity): string {
  return `agent-os:${JSON.stringify([
    identity.runId,
    identity.stepId,
    identity.tool,
    stableNormalize(identity.businessTarget),
  ])}`;
}

export interface ExecutionPort<
  TStartInput = unknown,
  TState = unknown,
  TCheckpoint = unknown,
  TResult = unknown,
  TFailure = unknown,
> {
  start(input: TStartInput): Promise<TState>;
  checkpoint(state: TState, checkpoint: TCheckpoint): Promise<TState>;
  pause(state: TState, reason: string): Promise<TState>;
  resume(state: TState): Promise<TState>;
  complete(state: TState, result: TResult): Promise<TState>;
  fail(state: TState, failure: TFailure): Promise<TState>;
}

export interface SkillDefinitionContract {
  name: string;
  version: string;
  domain: string;
  owner: string;
  risk: ToolRiskLevel;
  description: string;
  goal: string;
  whenToUse: readonly string[];
  whenNotToUse: readonly string[];
  requiredContext: readonly string[];
  allowedTools: readonly string[];
  forbiddenActions: readonly string[];
}

export function validateAgentLoopSpec(spec: AgentLoopSpec): string[] {
  const errors: string[] = [];

  if (!spec.goal.trim()) errors.push("goal_required");

  const positiveIntegerFields: Array<
    keyof Pick<
      AgentLoopSpec,
      "maxSteps" | "maxToolCalls" | "maxTokens" | "maxRuntimeMs" | "repeatedToolLimit" | "noProgressLimit"
    >
  > = ["maxSteps", "maxToolCalls", "maxTokens", "maxRuntimeMs", "repeatedToolLimit", "noProgressLimit"];

  for (const field of positiveIntegerFields) {
    const value = spec[field];
    if (!Number.isInteger(value) || value <= 0) errors.push(`${field}_must_be_positive_integer`);
  }

  if (!Number.isFinite(spec.maxCostCents) || spec.maxCostCents < 0) {
    errors.push("maxCostCents_must_be_non_negative");
  }

  return errors;
}
