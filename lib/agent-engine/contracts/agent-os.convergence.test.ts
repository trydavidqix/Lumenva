import { describe, expect, it } from "vitest";

import {
  TERMINAL_AGENT_RUN_STATUSES,
  deriveToolIdempotencyKey,
  evaluateLoopBudget,
  evaluateNoProgress,
  evaluateRepeatedTool,
  isAgentRunTransitionAllowed,
  isAutonomyEligibleRisk,
  type AgentLoopSpec,
} from "./agent-os";

const spec: AgentLoopSpec = {
  goal: "resolver o turno sem side effects fora de policy",
  maxSteps: 6,
  maxToolCalls: 4,
  maxTokens: 2_000,
  maxCostCents: 30,
  maxRuntimeMs: 15_000,
  repeatedToolLimit: 3,
  noProgressLimit: 3,
};

describe("Agent OS converged contracts", () => {
  it("keeps terminal run states terminal", () => {
    for (const status of TERMINAL_AGENT_RUN_STATUSES) {
      expect(isAgentRunTransitionAllowed(status, "running")).toBe(false);
      expect(isAgentRunTransitionAllowed(status, "completed")).toBe(false);
    }
  });

  it.each([
    ["tokens", { tokensUsed: spec.maxTokens }, "max_tokens_exhausted"],
    ["cost", { costCents: spec.maxCostCents }, "max_cost_exhausted"],
    ["runtime", { runtimeMs: spec.maxRuntimeMs }, "max_runtime_exhausted"],
  ] as const)("stops when the %s ceiling is reached", (_name, override, reason) => {
    const result = evaluateLoopBudget(spec, {
      steps: 0,
      toolCalls: 0,
      tokensUsed: 0,
      costCents: 0,
      runtimeMs: 0,
      ...override,
    });

    expect(result).toEqual({ kind: "stop", reason });
  });

  it("detects repeated tool calls even when object key order differs", () => {
    const result = evaluateRepeatedTool(spec, [
      { tool: "lookup_order", args: { orderId: "o1", organizationId: "org1" } },
      { tool: "lookup_order", args: { organizationId: "org1", orderId: "o1" } },
      { tool: "lookup_order", args: { orderId: "o1", organizationId: "org1" } },
    ]);

    expect(result).toEqual({ kind: "stop", reason: "repeated_tool_exhausted" });
  });

  it("stops a loop that repeatedly produces the same business-state fingerprint", () => {
    expect(evaluateNoProgress(spec, ["state:v4", "state:v4", "state:v4"]))
      .toEqual({ kind: "stop", reason: "no_progress_exhausted" });
  });

  it("derives a stable idempotency key for equivalent business targets", () => {
    const left = deriveToolIdempotencyKey({
      runId: "run-1",
      stepId: "step-2",
      tool: "send_message",
      businessTarget: { contactId: "c1", conversationId: "cv1" },
    });
    const right = deriveToolIdempotencyKey({
      runId: "run-1",
      stepId: "step-2",
      tool: "send_message",
      businessTarget: { conversationId: "cv1", contactId: "c1" },
    });

    expect(left).toBe(right);
  });

  it("makes R4 structurally ineligible for autonomous execution", () => {
    expect(isAutonomyEligibleRisk("r4_destructive_admin")).toBe(false);
    expect(isAutonomyEligibleRisk("r0_read")).toBe(true);
  });
});
