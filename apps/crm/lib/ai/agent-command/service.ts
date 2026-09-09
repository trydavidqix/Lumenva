import { createHash, randomUUID } from "node:crypto";

export type AgentCommandApprovalStatus =
  | "pending"
  | "approved"
  | "denied"
  | "executing"
  | "executed"
  | "expired"
  | "failed";

export interface AgentCommandApproval {
  id: string;
  organizationId: string;
  agentId: string;
  agentVersionId: string;
  requestedBy: string;
  traceId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  message: string;
  requestHash: string;
  idempotencyKey: string;
  reason: string;
  status: AgentCommandApprovalStatus;
  createdAt: string;
  expiresAt: string;
  decidedAt?: string;
  decidedBy?: string;
  decisionReason?: string;
  executedAt?: string;
  result?: unknown;
  errorCode?: string;
}

export interface AgentCommandApprovalRepository {
  findByIdempotencyKey(
    organizationId: string,
    idempotencyKey: string,
  ): Promise<AgentCommandApproval | null>;
  create(
    input: Omit<AgentCommandApproval, "status" | "createdAt">,
  ): Promise<AgentCommandApproval>;
  get(input: {
    approvalId: string;
    organizationId: string;
    agentId: string;
  }): Promise<AgentCommandApproval | null>;
  decide(input: {
    approvalId: string;
    organizationId: string;
    agentId: string;
    decision: "approved" | "denied";
    decidedBy: string;
    reason?: string;
    now: string;
  }): Promise<AgentCommandApproval | null>;
  claimExecution(input: {
    approvalId: string;
    organizationId: string;
    agentId: string;
  }): Promise<{ approval: AgentCommandApproval; claimed: boolean } | null>;
  markExecuted(input: {
    approvalId: string;
    organizationId: string;
    result: unknown;
    executedAt: string;
  }): Promise<AgentCommandApproval | null>;
  markFailed(input: {
    approvalId: string;
    organizationId: string;
    errorCode: string;
    executedAt: string;
  }): Promise<AgentCommandApproval | null>;
}

export interface PublishedCommandAgent {
  agentId: string;
  versionId: string;
  operatorEnabled: boolean;
  conversationalToolIds: readonly string[];
  operatorToolIds: readonly string[];
  systemPrompt?: string;
  provider?: string;
  model?: string;
  credentialId?: string | null;
}

export type AgentCommandPlan =
  | { kind: "answer"; message: string }
  | {
      kind: "tool";
      toolName: string;
      args: Record<string, unknown>;
      message: string;
    };

export interface ResolvedCommandTool {
  name: string;
  category: "read" | "write" | "handoff";
  validateArgs(input: unknown):
    | { ok: true; data: Record<string, unknown> }
    | { ok: false; details?: unknown };
}

interface AgentCommandServiceDependencies {
  approvals: AgentCommandApprovalRepository;
  analyze(input: {
    organizationId: string;
    agent: PublishedCommandAgent;
    command: string;
    traceId: string;
  }): Promise<AgentCommandPlan>;
  loadPublishedAgent(input: {
    organizationId: string;
    agentId: string;
  }): Promise<PublishedCommandAgent | null>;
  resolveTool(toolName: string): ResolvedCommandTool | null;
  executeTool(input: {
    organizationId: string;
    userId: string;
    agentId: string;
    toolName: string;
    args: Record<string, unknown>;
    requestId: string;
  }): Promise<unknown>;
  now?: () => Date;
  idFactory?: () => string;
  traceIdFactory?: () => string;
}

export class AgentCommandError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(code);
    this.name = "AgentCommandError";
  }
}

function requestHash(agent: PublishedCommandAgent, command: string): string {
  return createHash("sha256")
    .update(JSON.stringify([agent.agentId, agent.versionId, command]))
    .digest("hex");
}

function approvalResponse(row: AgentCommandApproval, replay = false) {
  if (row.status === "pending" || row.status === "approved") {
    return {
      status: "needs_confirmation" as const,
      approvalId: row.id,
      toolName: row.toolName,
      message: row.message,
      args: row.toolArgs,
      expiresAt: row.expiresAt,
      traceId: row.traceId,
      ...(replay ? { replay: true as const } : {}),
    };
  }
  if (row.status === "executed") {
    return {
      status: "executed" as const,
      approvalId: row.id,
      toolName: row.toolName,
      message: row.message,
      result: row.result,
      traceId: row.traceId,
      ...(replay ? { replay: true as const } : {}),
    };
  }
  return {
    status: row.status,
    approvalId: row.id,
    toolName: row.toolName,
    message: row.message,
    traceId: row.traceId,
    ...(replay ? { replay: true as const } : {}),
  };
}

export function createAgentCommandService(deps: AgentCommandServiceDependencies) {
  const now = deps.now ?? (() => new Date());
  const idFactory = deps.idFactory ?? randomUUID;
  const traceIdFactory = deps.traceIdFactory ?? randomUUID;

  async function loadAgent(organizationId: string, agentId: string) {
    const agent = await deps.loadPublishedAgent({ organizationId, agentId });
    if (!agent) throw new AgentCommandError("published_agent_not_found", 404);
    return agent;
  }

  function resolveAndValidateTool(
    agent: PublishedCommandAgent,
    toolName: string,
    rawArgs: unknown,
  ) {
    const tool = deps.resolveTool(toolName);
    if (!tool) throw new AgentCommandError("tool_not_found", 422);

    const allowed =
      tool.category === "read"
        ? agent.conversationalToolIds.includes(toolName) || agent.operatorToolIds.includes(toolName)
        : agent.operatorEnabled && agent.operatorToolIds.includes(toolName);
    if (!allowed) throw new AgentCommandError("tool_not_allowed", 403);

    const parsed = tool.validateArgs(rawArgs);
    if (!parsed.ok) {
      throw new AgentCommandError("tool_args_invalid", 422, parsed.details);
    }
    return { tool, args: parsed.data };
  }

  return {
    async submit(input: {
      organizationId: string;
      userId: string;
      agentId: string;
      command: string;
      idempotencyKey: string;
      requestId?: string;
    }) {
      const traceId = input.requestId ?? traceIdFactory();
      const agent = await loadAgent(input.organizationId, input.agentId);
      const hash = requestHash(agent, input.command);
      const existing = await deps.approvals.findByIdempotencyKey(
        input.organizationId,
        input.idempotencyKey,
      );
      if (existing) {
        if (existing.requestHash !== hash || existing.agentId !== input.agentId) {
          throw new AgentCommandError("idempotency_conflict", 409);
        }
        return approvalResponse(existing, true);
      }

      const plan = await deps.analyze({
        organizationId: input.organizationId,
        agent,
        command: input.command,
        traceId,
      });
      if (plan.kind === "answer") {
        return { status: "answer" as const, message: plan.message, traceId };
      }

      const { tool, args } = resolveAndValidateTool(agent, plan.toolName, plan.args);
      if (tool.category === "read") {
        const result = await deps.executeTool({
          organizationId: input.organizationId,
          userId: input.userId,
          agentId: input.agentId,
          toolName: tool.name,
          args,
          requestId: traceId,
        });
        return {
          status: "executed" as const,
          message: plan.message,
          toolName: tool.name,
          result,
          traceId,
        };
      }

      const approvalId = idFactory();
      const created = await deps.approvals.create({
        id: approvalId,
        organizationId: input.organizationId,
        agentId: input.agentId,
        agentVersionId: agent.versionId,
        requestedBy: input.userId,
        traceId,
        toolName: tool.name,
        toolArgs: args,
        message: plan.message,
        requestHash: hash,
        idempotencyKey: input.idempotencyKey,
        reason: "write_requires_confirmation",
        expiresAt: new Date(now().getTime() + 10 * 60_000).toISOString(),
      });
      if (created.requestHash !== hash || created.agentId !== input.agentId) {
        throw new AgentCommandError("idempotency_conflict", 409);
      }
      return approvalResponse(created, created.id !== approvalId);
    },

    async decide(input: {
      organizationId: string;
      userId: string;
      agentId: string;
      approvalId: string;
      decision: "approve" | "deny";
      reason?: string;
      requestId?: string;
    }) {
      const existing = await deps.approvals.get({
        approvalId: input.approvalId,
        organizationId: input.organizationId,
        agentId: input.agentId,
      });
      if (!existing) throw new AgentCommandError("approval_not_found", 404);

      if (input.decision === "approve") {
        const agent = await loadAgent(input.organizationId, input.agentId);
        if (agent.versionId !== existing.agentVersionId) {
          throw new AgentCommandError("agent_version_changed", 409);
        }
        resolveAndValidateTool(agent, existing.toolName, existing.toolArgs);
      }

      const targetStatus = input.decision === "approve" ? "approved" : "denied";
      const decided = await deps.approvals.decide({
        approvalId: input.approvalId,
        organizationId: input.organizationId,
        agentId: input.agentId,
        decision: targetStatus,
        decidedBy: input.userId,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
        now: now().toISOString(),
      });
      if (!decided) throw new AgentCommandError("approval_not_found", 404);
      if (decided.status === "expired") return approvalResponse(decided);

      if (input.decision === "deny") {
        if (decided.status !== "denied") {
          throw new AgentCommandError("approval_decision_conflict", 409);
        }
        return approvalResponse(decided, existing.status === "denied");
      }

      if (decided.status === "executed") return approvalResponse(decided, true);
      if (decided.status === "executing") return approvalResponse(decided, true);
      if (decided.status !== "approved") {
        throw new AgentCommandError("approval_decision_conflict", 409);
      }

      const claimed = await deps.approvals.claimExecution({
        approvalId: input.approvalId,
        organizationId: input.organizationId,
        agentId: input.agentId,
      });
      if (!claimed) throw new AgentCommandError("approval_not_found", 404);
      if (!claimed.claimed) {
        if (claimed.approval.status === "executed" || claimed.approval.status === "executing") {
          return approvalResponse(claimed.approval, true);
        }
        throw new AgentCommandError("approval_execution_conflict", 409);
      }
      const executing = claimed.approval;

      try {
        const result = await deps.executeTool({
          organizationId: input.organizationId,
          userId: input.userId,
          agentId: input.agentId,
          toolName: executing.toolName,
          args: executing.toolArgs,
          requestId: input.requestId ?? executing.traceId,
        });
        const executed = await deps.approvals.markExecuted({
          approvalId: executing.id,
          organizationId: input.organizationId,
          result,
          executedAt: now().toISOString(),
        });
        if (!executed) throw new AgentCommandError("approval_execution_conflict", 409);
        return approvalResponse(executed);
      } catch (error) {
        if (error instanceof AgentCommandError) throw error;
        await deps.approvals.markFailed({
          approvalId: executing.id,
          organizationId: input.organizationId,
          errorCode: "tool_execution_failed",
          executedAt: now().toISOString(),
        });
        throw new AgentCommandError("tool_execution_failed", 500);
      }
    },
  };
}
