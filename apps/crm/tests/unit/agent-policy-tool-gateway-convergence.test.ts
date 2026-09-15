import { describe, expect, it, vi } from "vitest";

import { decideApprovalRequest, enforceApprovalDecision, type ApprovalRequest, type ApprovalStore } from "../../lib/agent-engine/policies/approval";
import { evaluateToolPolicy } from "../../lib/agent-engine/policies/engine";
import { createKernelToolGatewayPort, executeThroughToolGateway } from "../../lib/agent-engine/tools/gateway";
import { createToolRegistry, type AgentToolDefinition } from "../../lib/agent-engine/tools/registry";
import type { ResolvedKernelExecution } from "../../lib/agent-engine/kernel/contracts";

class MemoryApprovalStore implements ApprovalStore {
  readonly records = new Map<string, ApprovalRequest>();
  async save(request: ApprovalRequest): Promise<void> {
    this.records.set(request.id, { ...request });
  }
  async load(id: string): Promise<ApprovalRequest | null> {
    return this.records.get(id) ?? null;
  }
  async compareAndSet(id: string, expectedStatus: ApprovalRequest['status'], next: ApprovalRequest): Promise<boolean> {
    const current = this.records.get(id);
    if (!current || current.status !== expectedStatus) return false;
    this.records.set(id, { ...next });
    return true;
  }
}

function tool(overrides: Partial<AgentToolDefinition> = {}): AgentToolDefinition {
  return {
    id: "send_message",
    owner: "agent-engine.channel",
    source: "internal",
    schema: { kind: "inline", value: {} },
    risk: "r2_external_communication",
    hasSideEffect: true,
    idempotencyRequired: true,
    timeoutMs: 30_000,
    maxRetries: 2,
    ...overrides,
  };
}

function execution(): ResolvedKernelExecution {
  return {
    runId: "run-a",
    organizationId: "org-a",
    agentId: "agent-a",
    agentVersion: "1.0.0",
    traceId: "trace-a",
    correlationId: "corr-a",
    goal: "resolver",
    trigger: { kind: "inbound_turn", sourceId: "conversation-a" },
    resume: false,
    definition: {
      id: "agent-a",
      version: "1.0.0",
      objective: "resolver",
      autonomyLevel: "assisted",
      allowedSkills: [],
      allowedTools: ["send_message"],
      requiredModelCapabilities: ["structured_output"],
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
    },
  };
}

describe("converged policy and Tool Gateway", () => {
  it("denies R4 at the deterministic policy boundary", () => {
    const decision = evaluateToolPolicy({
      organizationId: "org-a",
      agentId: "agent-a",
      autonomyLevel: "autopilot_expanded",
      tool: tool({
        id: "delete_tenant",
        risk: "r4_destructive_admin",
        maxRetries: 0,
      }),
    });

    expect(decision).toEqual({ kind: "deny", reason: "r4_requires_human" });
  });

  it("requires approval for R3 even at expanded autonomy", () => {
    const decision = evaluateToolPolicy({
      organizationId: "org-a",
      agentId: "agent-a",
      autonomyLevel: "autopilot_expanded",
      tool: tool({ id: "apply_discount", risk: "r3_sensitive_commercial" }),
    });

    expect(decision).toMatchObject({
      kind: "require_approval",
      reason: "sensitive_commercial_requires_approval",
    });
  });

  it("rechecks persisted kill switches before executing a side effect", async () => {
    const execute = vi.fn(async () => ({ delivered: true }));
    const result = await executeThroughToolGateway({
      organizationId: "org-a",
      agentId: "agent-a",
      runId: "run-a",
      autonomyLevel: "autopilot_low_risk",
      runtimeAutonomyStore: {
        load: async () => ({ tenantEnabled: false }),
      },
      tool: tool({ id: "update_lead_state", risk: "r1_reversible_write" }),
      args: { stage: "qualified" },
      idempotencyKey: "run-a:step-1:update",
      execute,
      approvalStore: null,
    });

    expect(result).toEqual({ kind: "denied", reason: "tenant_kill_switch" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("creates a durable approval without trusting a spoofed organization in tool args", async () => {
    const approvals = new MemoryApprovalStore();
    const registry = createToolRegistry([tool()]);
    const executeTool = vi.fn(async () => ({ delivered: true }));
    const gateway = createKernelToolGatewayPort({
      registry,
      approvalStore: approvals,
      executeTool,
    });

    const result = await gateway.execute({
      execution: execution(),
      tool: { id: "send_message", risk: "r2_external_communication", hasSideEffect: true, idempotencyRequired: true },
      args: { organizationId: "org-b", body: "oi" },
      idempotencyKey: "run-a:step-1:send",
    });

    expect(result.kind).toBe("approval_required");
    expect(executeTool).not.toHaveBeenCalled();
    const request = [...approvals.records.values()][0];
    expect(request?.organizationId).toBe("org-a");
    expect(request?.agentId).toBe("agent-a");
    expect(request?.idempotencyKey).toBe("run-a:step-1:send");
  });

  it("executes an approved request at most once through its durable identity", async () => {
    const approvals = new MemoryApprovalStore();
    const pending = await import("../../lib/agent-engine/policies/approval").then(({ createApprovalRequest }) =>
      createApprovalRequest(approvals, {
        organizationId: "org-a",
        runId: "run-a",
        agentId: "agent-a",
        toolId: "send_message",
        approvalType: "external_communication",
        idempotencyKey: "stable-key",
        reason: "approval_required",
      }),
    );
    await decideApprovalRequest(
      approvals,
      pending.id,
      { decision: "approved", decidedBy: "user-1" },
      { organizationId: "org-a" },
    );

    const execute = vi.fn(async () => ({ ok: true }));
    const first = await enforceApprovalDecision(approvals, pending.id, execute, { organizationId: "org-a" });
    const second = await enforceApprovalDecision(approvals, pending.id, execute, { organizationId: "org-a" });

    expect(first.kind).toBe("executed");
    expect(second.kind).toBe("already_executed");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("rejects duplicate tool IDs so MCP/internal definitions cannot shadow each other", () => {
    expect(() => createToolRegistry([tool(), tool()])).toThrow("duplicate_tool_id:send_message");
  });
});
