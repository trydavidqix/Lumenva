import { describe, expect, it, vi } from "vitest";

import {
  AgentCommandError,
  createAgentCommandService,
  type AgentCommandApproval,
  type AgentCommandApprovalRepository,
  type PublishedCommandAgent,
} from "./service";

const ORG_A = "22222222-2222-4222-8222-222222222222";
const ORG_B = "99999999-9999-4999-8999-999999999999";
const USER = "11111111-1111-4111-8111-111111111111";
const AGENT = "33333333-3333-4333-8333-333333333333";
const VERSION = "44444444-4444-4444-8444-444444444444";
const APPROVAL = "55555555-5555-4555-8555-555555555555";
const TRACE = "66666666-6666-4666-8666-666666666666";
const IDEMPOTENCY = "77777777-7777-4777-8777-777777777777";
const NOW = new Date("2026-09-07T12:00:00.000Z");

function publishedAgent(overrides: Partial<PublishedCommandAgent> = {}): PublishedCommandAgent {
  return {
    agentId: AGENT,
    versionId: VERSION,
    operatorEnabled: true,
    conversationalToolIds: ["crm_search_contacts"],
    operatorToolIds: ["crm_add_lead_note"],
    ...overrides,
  };
}

class MemoryApprovalRepository implements AgentCommandApprovalRepository {
  readonly rows = new Map<string, AgentCommandApproval>();

  async findByIdempotencyKey(organizationId: string, idempotencyKey: string) {
    return (
      [...this.rows.values()].find(
        (row) => row.organizationId === organizationId && row.idempotencyKey === idempotencyKey,
      ) ?? null
    );
  }

  async create(input: Omit<AgentCommandApproval, "status" | "createdAt">) {
    const existing = await this.findByIdempotencyKey(input.organizationId, input.idempotencyKey);
    if (existing) return existing;
    const row: AgentCommandApproval = {
      ...input,
      status: "pending",
      createdAt: NOW.toISOString(),
    };
    this.rows.set(row.id, structuredClone(row));
    return row;
  }

  async get(input: { approvalId: string; organizationId: string; agentId: string }) {
    const row = this.rows.get(input.approvalId);
    if (!row || row.organizationId !== input.organizationId || row.agentId !== input.agentId) {
      return null;
    }
    return structuredClone(row);
  }

  async decide(input: {
    approvalId: string;
    organizationId: string;
    agentId: string;
    decision: "approved" | "denied";
    decidedBy: string;
    reason?: string;
    now: string;
  }) {
    const row = await this.get(input);
    if (!row) return null;
    if (row.status === "pending" && Date.parse(row.expiresAt) <= Date.parse(input.now)) {
      const expired = { ...row, status: "expired" as const, decidedAt: input.now };
      this.rows.set(row.id, expired);
      return expired;
    }
    if (row.status !== "pending") return row;
    const decided = {
      ...row,
      status: input.decision,
      decidedAt: input.now,
      decidedBy: input.decidedBy,
      ...(input.reason === undefined ? {} : { decisionReason: input.reason }),
    };
    this.rows.set(row.id, decided);
    return decided;
  }

  async claimExecution(input: { approvalId: string; organizationId: string; agentId: string }) {
    const row = await this.get(input);
    if (!row) return null;
    if (row.status !== "approved") return { approval: row, claimed: false };
    const claimed = { ...row, status: "executing" as const };
    this.rows.set(row.id, claimed);
    return { approval: claimed, claimed: true };
  }

  async markExecuted(input: {
    approvalId: string;
    organizationId: string;
    result: unknown;
    executedAt: string;
  }) {
    const row = this.rows.get(input.approvalId);
    if (!row || row.organizationId !== input.organizationId || row.status !== "executing") return null;
    const executed = {
      ...row,
      status: "executed" as const,
      result: input.result,
      executedAt: input.executedAt,
    };
    this.rows.set(row.id, executed);
    return executed;
  }

  async markFailed(input: {
    approvalId: string;
    organizationId: string;
    errorCode: string;
    executedAt: string;
  }) {
    const row = this.rows.get(input.approvalId);
    if (!row || row.organizationId !== input.organizationId || row.status !== "executing") return null;
    const failed = {
      ...row,
      status: "failed" as const,
      errorCode: input.errorCode,
      executedAt: input.executedAt,
    };
    this.rows.set(row.id, failed);
    return failed;
  }
}

function setup(input: {
  plan?:
    | { kind: "answer"; message: string }
    | { kind: "tool"; toolName: string; args: Record<string, unknown>; message: string };
  currentAgent?: PublishedCommandAgent | null;
} = {}) {
  const approvals = new MemoryApprovalRepository();
  const executeTool = vi.fn(async ({ toolName }: { toolName: string }) => ({ tool: toolName, ok: true }));
  const analyze = vi.fn(async () => input.plan ?? ({ kind: "answer" as const, message: "Olá." }));
  const loadPublishedAgent = vi.fn(async () =>
    input.currentAgent === undefined ? publishedAgent() : input.currentAgent,
  );
  const resolveTool = vi.fn((toolName: string) => {
    if (toolName === "crm_search_contacts") {
      return {
        name: toolName,
        category: "read" as const,
        validateArgs: (args: unknown) => ({ ok: true as const, data: args as Record<string, unknown> }),
      };
    }
    if (toolName === "crm_add_lead_note") {
      return {
        name: toolName,
        category: "write" as const,
        validateArgs: (args: unknown) => ({ ok: true as const, data: args as Record<string, unknown> }),
      };
    }
    return null;
  });
  const service = createAgentCommandService({
    approvals,
    analyze,
    loadPublishedAgent,
    resolveTool,
    executeTool,
    now: () => NOW,
    idFactory: () => APPROVAL,
    traceIdFactory: () => TRACE,
  });
  return { service, approvals, analyze, executeTool, loadPublishedAgent };
}

describe("browser agent command service", () => {
  it("returns a direct answer without touching tools or approvals", async () => {
    const { service, executeTool, approvals } = setup({
      plan: { kind: "answer", message: "Posso ajudar com o CRM." },
    });

    const result = await service.submit({
      organizationId: ORG_A,
      userId: USER,
      agentId: AGENT,
      command: "o que você faz?",
      idempotencyKey: IDEMPOTENCY,
      requestId: TRACE,
    });

    expect(result).toEqual({ status: "answer", message: "Posso ajudar com o CRM.", traceId: TRACE });
    expect(executeTool).not.toHaveBeenCalled();
    expect(approvals.rows).toHaveLength(0);
  });

  it("executes an allowed read tool immediately", async () => {
    const { service, executeTool } = setup({
      plan: {
        kind: "tool",
        toolName: "crm_search_contacts",
        args: { query: "cliente" },
        message: "Consulta concluída.",
      },
    });

    const result = await service.submit({
      organizationId: ORG_A,
      userId: USER,
      agentId: AGENT,
      command: "procure o cliente",
      idempotencyKey: IDEMPOTENCY,
      requestId: TRACE,
    });

    expect(result).toMatchObject({
      status: "executed",
      message: "Consulta concluída.",
      toolName: "crm_search_contacts",
      result: { tool: "crm_search_contacts", ok: true },
      traceId: TRACE,
    });
    expect(executeTool).toHaveBeenCalledTimes(1);
  });

  it("persists a write approval and never executes before approval", async () => {
    const { service, executeTool, approvals } = setup({
      plan: {
        kind: "tool",
        toolName: "crm_add_lead_note",
        args: { contact_id: "88888888-8888-4888-8888-888888888888", note: "Retornar amanhã" },
        message: "Vou adicionar uma nota ao negócio.",
      },
    });

    const result = await service.submit({
      organizationId: ORG_A,
      userId: USER,
      agentId: AGENT,
      command: "adicione a nota",
      idempotencyKey: IDEMPOTENCY,
      requestId: TRACE,
    });

    expect(result).toMatchObject({
      status: "needs_confirmation",
      approvalId: APPROVAL,
      toolName: "crm_add_lead_note",
      expiresAt: "2026-09-07T12:10:00.000Z",
      traceId: TRACE,
    });
    expect(executeTool).not.toHaveBeenCalled();
    expect(approvals.rows.get(APPROVAL)).toMatchObject({
      status: "pending",
      organizationId: ORG_A,
      agentId: AGENT,
      agentVersionId: VERSION,
      idempotencyKey: IDEMPOTENCY,
    });
  });

  it("fails closed when the model proposes a tool outside the published allowlist", async () => {
    const { service, executeTool } = setup({
      plan: {
        kind: "tool",
        toolName: "crm_add_lead_note",
        args: {},
        message: "Vou alterar.",
      },
      currentAgent: publishedAgent({ operatorToolIds: [] }),
    });

    await expect(
      service.submit({
        organizationId: ORG_A,
        userId: USER,
        agentId: AGENT,
        command: "altere",
        idempotencyKey: IDEMPOTENCY,
        requestId: TRACE,
      }),
    ).rejects.toMatchObject({ code: "tool_not_allowed" });
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("approves and executes a pending write exactly once across replay", async () => {
    const { service, executeTool } = setup({
      plan: {
        kind: "tool",
        toolName: "crm_add_lead_note",
        args: { note: "Retornar amanhã" },
        message: "Vou adicionar uma nota.",
      },
    });
    await service.submit({
      organizationId: ORG_A,
      userId: USER,
      agentId: AGENT,
      command: "adicione a nota",
      idempotencyKey: IDEMPOTENCY,
      requestId: TRACE,
    });

    const first = await service.decide({
      organizationId: ORG_A,
      userId: USER,
      agentId: AGENT,
      approvalId: APPROVAL,
      decision: "approve",
      requestId: TRACE,
    });
    const replay = await service.decide({
      organizationId: ORG_A,
      userId: USER,
      agentId: AGENT,
      approvalId: APPROVAL,
      decision: "approve",
      requestId: TRACE,
    });

    expect(first).toMatchObject({ status: "executed", approvalId: APPROVAL });
    expect(replay).toMatchObject({ status: "executed", approvalId: APPROVAL, replay: true });
    expect(executeTool).toHaveBeenCalledTimes(1);
  });

  it("denies a pending write without executing it", async () => {
    const { service, executeTool } = setup({
      plan: {
        kind: "tool",
        toolName: "crm_add_lead_note",
        args: { note: "Retornar amanhã" },
        message: "Vou adicionar uma nota.",
      },
    });
    await service.submit({
      organizationId: ORG_A,
      userId: USER,
      agentId: AGENT,
      command: "adicione a nota",
      idempotencyKey: IDEMPOTENCY,
      requestId: TRACE,
    });

    const result = await service.decide({
      organizationId: ORG_A,
      userId: USER,
      agentId: AGENT,
      approvalId: APPROVAL,
      decision: "deny",
      reason: "não agora",
      requestId: TRACE,
    });

    expect(result).toMatchObject({ status: "denied", approvalId: APPROVAL });
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("expires a stale approval and never executes it", async () => {
    const { service, approvals, executeTool } = setup();
    approvals.rows.set(APPROVAL, {
      id: APPROVAL,
      organizationId: ORG_A,
      agentId: AGENT,
      agentVersionId: VERSION,
      requestedBy: USER,
      traceId: TRACE,
      toolName: "crm_add_lead_note",
      toolArgs: { note: "Retornar amanhã" },
      message: "Vou adicionar uma nota.",
      requestHash: "hash",
      idempotencyKey: IDEMPOTENCY,
      reason: "write_requires_confirmation",
      status: "pending",
      createdAt: "2026-09-07T11:00:00.000Z",
      expiresAt: "2026-09-07T11:10:00.000Z",
    });

    const result = await service.decide({
      organizationId: ORG_A,
      userId: USER,
      agentId: AGENT,
      approvalId: APPROVAL,
      decision: "approve",
      requestId: TRACE,
    });

    expect(result).toMatchObject({ status: "expired", approvalId: APPROVAL });
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("does not reveal or execute an approval from another tenant", async () => {
    const { service, approvals, executeTool } = setup();
    approvals.rows.set(APPROVAL, {
      id: APPROVAL,
      organizationId: ORG_A,
      agentId: AGENT,
      agentVersionId: VERSION,
      requestedBy: USER,
      traceId: TRACE,
      toolName: "crm_add_lead_note",
      toolArgs: { note: "Privado" },
      message: "Vou adicionar uma nota.",
      requestHash: "hash",
      idempotencyKey: IDEMPOTENCY,
      reason: "write_requires_confirmation",
      status: "pending",
      createdAt: NOW.toISOString(),
      expiresAt: "2026-09-07T12:10:00.000Z",
    });

    await expect(
      service.decide({
        organizationId: ORG_B,
        userId: USER,
        agentId: AGENT,
        approvalId: APPROVAL,
        decision: "approve",
        requestId: TRACE,
      }),
    ).rejects.toEqual(new AgentCommandError("approval_not_found", 404));
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("refuses approval when the published version changed after planning", async () => {
    const { service, approvals, executeTool } = setup({
      currentAgent: publishedAgent({ versionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    });
    approvals.rows.set(APPROVAL, {
      id: APPROVAL,
      organizationId: ORG_A,
      agentId: AGENT,
      agentVersionId: VERSION,
      requestedBy: USER,
      traceId: TRACE,
      toolName: "crm_add_lead_note",
      toolArgs: { note: "Retornar amanhã" },
      message: "Vou adicionar uma nota.",
      requestHash: "hash",
      idempotencyKey: IDEMPOTENCY,
      reason: "write_requires_confirmation",
      status: "pending",
      createdAt: NOW.toISOString(),
      expiresAt: "2026-09-07T12:10:00.000Z",
    });

    await expect(
      service.decide({
        organizationId: ORG_A,
        userId: USER,
        agentId: AGENT,
        approvalId: APPROVAL,
        decision: "approve",
        requestId: TRACE,
      }),
    ).rejects.toMatchObject({ code: "agent_version_changed" });
    expect(executeTool).not.toHaveBeenCalled();
  });
});
