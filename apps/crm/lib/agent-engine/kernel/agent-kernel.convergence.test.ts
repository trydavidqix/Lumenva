import { describe, expect, it, vi } from "vitest";

import type { AgentDefinition, AgentRunStatus } from "../contracts/agent-os";
import { createAgentKernel } from "./agent-kernel";
import type { AgentKernelInput, ResolvedKernelAgent } from "./contracts";
import type { AgentKernelDependencies, KernelExecutionState } from "./ports";

const baseDefinition: AgentDefinition = {
  id: "agent-atendimento",
  version: "1.0.0",
  objective: "atender",
  autonomyLevel: "shadow",
  allowedSkills: [],
  allowedTools: ["send_message"],
  loop: {
    goal: "resolver",
    maxSteps: 5,
    maxToolCalls: 3,
    maxTokens: 2_000,
    maxCostCents: 50,
    maxRuntimeMs: 20_000,
    repeatedToolLimit: 3,
    noProgressLimit: 3,
  },
  requiredModelCapabilities: ["structured_output"],
};

const input: AgentKernelInput = {
  organizationId: "org-a",
  agentId: baseDefinition.id,
  goal: "responder ao cliente",
  trigger: { kind: "inbound_turn", sourceId: "conversation-1" },
  runId: "run-1",
  traceId: "trace-1",
  correlationId: "corr-1",
};

function state(status: AgentRunStatus = "running", keys: readonly string[] = []): KernelExecutionState {
  return { status, completedSideEffectKeys: keys };
}

function buildDependencies(options: {
  resolved?: ResolvedKernelAgent | null;
  definition?: AgentDefinition;
  runtimeStep?: AgentKernelDependencies["runtime"]["step"];
  verificationPassed?: boolean;
  gateway?: AgentKernelDependencies["toolGateway"]["execute"];
} = {}) {
  const definition = options.definition ?? baseDefinition;
  const resolved = options.resolved === undefined
    ? { organizationId: "org-a", enabled: true, definition }
    : options.resolved;

  const runtimeSpy = vi.fn(options.runtimeStep ?? (async () => ({
    kind: "final" as const,
    output: { text: "ok" },
    progressFingerprint: "final:ok",
    usage: { tokens: 20, costCents: 1, latencyMs: 10 },
  })));
  const gatewaySpy = vi.fn(options.gateway ?? (async () => ({ kind: "executed" as const, result: { ok: true } })));
  const memorySpy = vi.fn(async () => undefined);

  const deps: AgentKernelDependencies = {
    resolveAgent: async () => resolved,
    createIdentity: async (_kernelInput, agent) => ({
      runId: "run-1",
      organizationId: agent.organizationId,
      agentId: agent.definition.id,
      agentVersion: agent.definition.version,
      traceId: "trace-1",
      correlationId: "corr-1",
      goal: input.goal,
      trigger: input.trigger,
      definition: agent.definition,
      resume: false,
    }),
    loadContext: async () => ({ authoritative: {}, derivedMemory: {}, sources: ["crm:conversation-1"] }),
    loadSkills: async () => ({ activatedSkillVersions: [], index: "", bodies: "" }),
    resolveTools: async () => ({
      definitions: new Map([
        ["send_message", { id: "send_message", risk: "r2_external_communication", hasSideEffect: true, idempotencyRequired: true }],
      ]),
    }),
    selectModel: async () => ({
      id: "fake-model",
      provider: "fake",
      capabilities: ["structured_output"],
      certified: true,
      enabled: true,
    }),
    runtime: { step: runtimeSpy },
    toolGateway: { execute: gatewaySpy },
    execution: {
      start: async () => state(),
      resume: async (current) => current,
      checkpoint: async (current, checkpoint) => ({
        ...current,
        checkpointStepId: checkpoint.stepId,
        completedSideEffectKeys: checkpoint.completedSideEffectKeys ?? current.completedSideEffectKeys,
      }),
      pause: async (current) => ({ ...current, status: "waiting_approval" }),
      complete: async (current) => ({ ...current, status: "completed" }),
      stop: async (current, status) => ({ ...current, status }),
      fail: async (current) => ({ ...current, status: "permanent_failure" }),
    },
    verification: { verify: async () => ({ passed: options.verificationPassed ?? true, evidence: "typed-validator" }) },
    evidence: { record: async () => undefined },
    memory: { write: memorySpy },
    events: { emit: async () => undefined },
  };

  return { deps, runtimeSpy, gatewaySpy, memorySpy };
}

describe("converged Agent Kernel", () => {
  it("fails closed on tenant mismatch before model/runtime work", async () => {
    const { deps, runtimeSpy } = buildDependencies({
      resolved: { organizationId: "org-b", enabled: true, definition: baseDefinition },
    });

    const result = await createAgentKernel(deps).run(input);

    expect(result.status).toBe("blocked");
    expect(result.stopReason).toBe("tenant_mismatch");
    expect(runtimeSpy).not.toHaveBeenCalled();
  });

  it("completes a verified SHADOW result without persisting memory or sending", async () => {
    const { deps, gatewaySpy, memorySpy } = buildDependencies();

    const result = await createAgentKernel(deps).run(input);

    expect(result.status).toBe("completed");
    expect(result.output).toEqual({ text: "ok" });
    expect(gatewaySpy).not.toHaveBeenCalled();
    expect(memorySpy).not.toHaveBeenCalled();
  });

  it("blocks malformed/unverified output and never writes memory", async () => {
    const { deps, memorySpy } = buildDependencies({ verificationPassed: false });

    const result = await createAgentKernel(deps).run(input);

    expect(result.status).toBe("blocked");
    expect(result.stopReason).toBe("verification_failed");
    expect(memorySpy).not.toHaveBeenCalled();
  });

  it("prevents the existing send path from being invoked while the agent is SHADOW", async () => {
    const { deps, gatewaySpy } = buildDependencies({
      runtimeStep: async () => ({
        kind: "tool_call",
        stepId: "step-1",
        toolId: "send_message",
        args: { body: "oi" },
        businessTarget: { conversationId: "conversation-1" },
        progressFingerprint: "send:1",
        usage: { tokens: 12, costCents: 1, latencyMs: 8 },
      }),
    });

    const result = await createAgentKernel(deps).run(input);

    expect(result.status).toBe("policy_denied");
    expect(result.stopReason).toBe("autonomy_side_effect_blocked");
    expect(gatewaySpy).not.toHaveBeenCalled();
  });

  it("pauses durably when an assisted external action requires approval", async () => {
    const assisted = { ...baseDefinition, autonomyLevel: "assisted" as const };
    const { deps } = buildDependencies({
      definition: assisted,
      runtimeStep: async () => ({
        kind: "tool_call",
        stepId: "step-1",
        toolId: "send_message",
        args: { body: "mensagem aprovada" },
        businessTarget: { conversationId: "conversation-1" },
        progressFingerprint: "approval:1",
        usage: { tokens: 12, costCents: 1, latencyMs: 8 },
      }),
      gateway: async () => ({
        kind: "approval_required",
        reason: "external_communication_requires_approval",
        approvalId: "approval-1",
      }),
    });

    const result = await createAgentKernel(deps).run(input);

    expect(result.status).toBe("waiting_approval");
    expect(result.approvalId).toBe("approval-1");
  });
});
