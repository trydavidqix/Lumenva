import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import {
  AgentCommandError,
  createAgentCommandService,
  type AgentCommandApproval,
  type AgentCommandApprovalRepository,
  type AgentCommandPlan,
} from "@/lib/ai/agent-command/service";
import type { Role } from "@/lib/auth/types";
import { logger } from "@/lib/logger";
import { auditMcpToolCall } from "@/lib/mcp/audit";
import { ensureRole, ensureScope, type McpAuthResult } from "@/lib/mcp/auth";
import { allTools, getToolByName } from "@/lib/mcp/tools";
import type { McpContext } from "@/lib/mcp/types";
import { createAdminClient } from "@/lib/supabase/admin";

type DbError = { code?: string; message: string };
type DbResult<T> = { data: T | null; error: DbError | null };
type Row = Record<string, unknown>;
type Query = {
  select(columns?: string): Query;
  eq(column: string, value: unknown): Query;
  gt(column: string, value: unknown): Query;
  is(column: string, value: null): Query;
  lte(column: string, value: unknown): Query;
  insert(values: Record<string, unknown>): Query;
  update(values: Record<string, unknown>): Query;
  maybeSingle(): Promise<DbResult<Row>>;
  single(): Promise<DbResult<Row>>;
};

const SUPPORTED_TOOL_NAMES = new Set(allTools.map((tool) => tool.name));
const CONTACT_ID_PATTERN =
  "([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})";
const CONTACT_SEARCH_PATTERN = /^procure o contacto\s+(.+)$/iu;
const ADD_NOTE_PATTERN = new RegExp(`^adicione uma nota\\s+${CONTACT_ID_PATTERN}\\s+(.+)$`, "iu");

const UNSUPPORTED_COMMAND_MESSAGE =
  "Comando não suportado. Use: liste os leads; procure o contacto <texto>; ou adicione uma nota <contact_id> <texto>.";
const NOTE_NEEDS_CONTACT_MESSAGE =
  "Indique primeiro o UUID do contacto e depois a nota: adicione uma nota <contact_id> <texto>.";

function query(db: ReturnType<typeof createAdminClient>, table: string): Query {
  return db.from(table as never) as unknown as Query;
}

function required(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new AgentCommandError("command_runtime_unavailable", 503);
  }
  return value;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toolPlan(
  toolName: string,
  args: Record<string, unknown>,
  message: string,
): AgentCommandPlan {
  if (!SUPPORTED_TOOL_NAMES.has(toolName)) {
    throw new AgentCommandError("command_runtime_unavailable", 503);
  }
  return { kind: "tool", toolName, args, message };
}

/**
 * V1 intentionally accepts a small, explicit grammar. It never asks a model
 * to infer a tool name or write target.
 */
export function parseDeterministicCommand(command: string): AgentCommandPlan {
  const compact = command.trim().replace(/\s+/gu, " ");
  const normalized = compact.toLocaleLowerCase("pt-PT");

  if (normalized === "liste os leads") {
    return toolPlan("crm_list_leads", {}, "Leads encontrados.");
  }

  const contactSearch = CONTACT_SEARCH_PATTERN.exec(compact);
  if (contactSearch) {
    return toolPlan(
      "crm_search_contacts",
      { query: contactSearch[1]!.trim() },
      "Contactos encontrados.",
    );
  }

  const note = ADD_NOTE_PATTERN.exec(compact);
  if (note) {
    return toolPlan(
      "crm_add_lead_note",
      { contact_id: note[1]!.toLowerCase(), note: note[2]!.trim() },
      "A nota será adicionada após confirmação.",
    );
  }

  if (normalized.startsWith("adicione uma nota ")) {
    return { kind: "answer", message: NOTE_NEEDS_CONTACT_MESSAGE };
  }

  return { kind: "answer", message: UNSUPPORTED_COMMAND_MESSAGE };
}

function mapApproval(row: Row): AgentCommandApproval {
  return {
    id: required(row, "id"),
    organizationId: required(row, "organization_id"),
    agentId: required(row, "agent_id"),
    agentVersionId: required(row, "agent_version_id"),
    requestedBy: required(row, "requested_by"),
    traceId: required(row, "trace_id"),
    toolName: required(row, "tool_name"),
    toolArgs: (row.tool_args ?? {}) as Record<string, unknown>,
    message: required(row, "message"),
    requestHash: required(row, "request_hash"),
    idempotencyKey: required(row, "idempotency_key"),
    reason: required(row, "reason"),
    status: required(row, "status") as AgentCommandApproval["status"],
    createdAt: required(row, "created_at"),
    expiresAt: required(row, "expires_at"),
    decidedAt: typeof row.decided_at === "string" ? row.decided_at : undefined,
    decidedBy: typeof row.decided_by === "string" ? row.decided_by : undefined,
    decisionReason: typeof row.decision_reason === "string" ? row.decision_reason : undefined,
    executedAt: typeof row.executed_at === "string" ? row.executed_at : undefined,
    result: row.execution_result,
    errorCode: typeof row.error_code === "string" ? row.error_code : undefined,
  };
}

function failDatabase(error: DbError | null): never {
  logger.error("agent-command database operation failed", {
    error_code: error?.code ?? "unknown",
  });
  throw new AgentCommandError("command_runtime_unavailable", 503);
}

function createApprovalRepository(): AgentCommandApprovalRepository {
  const db = createAdminClient();
  return {
    async findByIdempotencyKey(organizationId, idempotencyKey) {
      const result = await query(db, "ai_agent_command_approvals")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (result.error) failDatabase(result.error);
      return result.data ? mapApproval(result.data) : null;
    },

    async create(input) {
      const result = await query(db, "ai_agent_command_approvals")
        .insert({
          id: input.id,
          organization_id: input.organizationId,
          agent_id: input.agentId,
          agent_version_id: input.agentVersionId,
          requested_by: input.requestedBy,
          trace_id: input.traceId,
          tool_name: input.toolName,
          tool_args: input.toolArgs,
          message: input.message,
          request_hash: input.requestHash,
          idempotency_key: input.idempotencyKey,
          reason: input.reason,
          expires_at: input.expiresAt,
        })
        .select("*")
        .single();
      if (result.error) {
        if (result.error.code === "23505") {
          const existing = await this.findByIdempotencyKey(
            input.organizationId,
            input.idempotencyKey,
          );
          if (existing) return existing;
        }
        failDatabase(result.error);
      }
      if (!result.data) failDatabase({ message: "approval_insert_empty" });
      return mapApproval(result.data);
    },

    async get(input) {
      const result = await query(db, "ai_agent_command_approvals")
        .select("*")
        .eq("id", input.approvalId)
        .eq("organization_id", input.organizationId)
        .eq("agent_id", input.agentId)
        .maybeSingle();
      if (result.error) failDatabase(result.error);
      return result.data ? mapApproval(result.data) : null;
    },

    async decide(input) {
      const result = await query(db, "ai_agent_command_approvals")
        .update({
          status: input.decision,
          decided_by: input.decidedBy,
          decided_at: input.now,
          decision_reason: input.reason ?? null,
        })
        .eq("id", input.approvalId)
        .eq("organization_id", input.organizationId)
        .eq("agent_id", input.agentId)
        .eq("status", "pending")
        .gt("expires_at", input.now)
        .select("*")
        .maybeSingle();
      if (result.error) failDatabase(result.error);
      if (result.data) return mapApproval(result.data);

      const expired = await query(db, "ai_agent_command_approvals")
        .update({ status: "expired", decided_at: input.now })
        .eq("id", input.approvalId)
        .eq("organization_id", input.organizationId)
        .eq("agent_id", input.agentId)
        .eq("status", "pending")
        .lte("expires_at", input.now)
        .select("*")
        .maybeSingle();
      if (expired.error) failDatabase(expired.error);
      if (expired.data) return mapApproval(expired.data);
      return this.get(input);
    },

    async claimExecution(input) {
      const result = await query(db, "ai_agent_command_approvals")
        .update({ status: "executing" })
        .eq("id", input.approvalId)
        .eq("organization_id", input.organizationId)
        .eq("agent_id", input.agentId)
        .eq("status", "approved")
        .select("*")
        .maybeSingle();
      if (result.error) failDatabase(result.error);
      if (result.data) return { approval: mapApproval(result.data), claimed: true };
      const current = await this.get(input);
      return current ? { approval: current, claimed: false } : null;
    },

    async markExecuted(input) {
      const result = await query(db, "ai_agent_command_approvals")
        .update({
          status: "executed",
          execution_result: input.result,
          executed_at: input.executedAt,
        })
        .eq("id", input.approvalId)
        .eq("organization_id", input.organizationId)
        .eq("status", "executing")
        .select("*")
        .maybeSingle();
      if (result.error) failDatabase(result.error);
      return result.data ? mapApproval(result.data) : null;
    },

    async markFailed(input) {
      const result = await query(db, "ai_agent_command_approvals")
        .update({
          status: "failed",
          error_code: input.errorCode,
          executed_at: input.executedAt,
        })
        .eq("id", input.approvalId)
        .eq("organization_id", input.organizationId)
        .eq("status", "executing")
        .select("*")
        .maybeSingle();
      if (result.error) failDatabase(result.error);
      return result.data ? mapApproval(result.data) : null;
    },
  };
}

interface ManagerMcpSession {
  auth: McpAuthResult;
  ctx: McpContext;
  close(): Promise<void>;
}

function isManagerRole(role: unknown): role is Extract<Role, "manager" | "admin"> {
  return role === "manager" || role === "admin";
}

async function createManagerMcpSession(input: {
  db: ReturnType<typeof createAdminClient>;
  organizationId: string;
  userId: string;
  requestId: string;
}): Promise<ManagerMcpSession> {
  const membership = await query(input.db, "user_organizations")
    .select("role, accepted_at, revoked_at")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (
    membership.error ||
    !membership.data ||
    !isManagerRole(membership.data.role) ||
    typeof membership.data.accepted_at !== "string" ||
    membership.data.revoked_at !== null
  ) {
    throw new Error("authenticated_manager_context_unavailable");
  }

  const role = membership.data.role;
  const scopes = ["mcp:read", "mcp:write", `role:${role}`];
  const entropy = randomBytes(32);
  const prefix = `dsk_cmd_${input.requestId.slice(0, 8)}_${randomBytes(4).toString("hex")}`;
  const token = await query(input.db, "api_tokens")
    .insert({
      organization_id: input.organizationId,
      created_by: input.userId,
      name: `browser-command:${input.requestId}`,
      prefix,
      token_hash: `\\x${createHash("sha256").update(entropy).digest("hex")}`,
      scopes,
      expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    })
    .select("id")
    .single();
  if (token.error || !token.data) {
    throw new Error("authenticated_manager_context_unavailable");
  }

  const apiTokenId = required(token.data, "id");
  const actor = { type: "user" as const, id: input.userId, role };
  const auth: McpAuthResult = {
    organizationId: input.organizationId,
    role,
    actor,
    apiTokenId,
    scopes,
  };
  const ctx: McpContext = {
    organizationId: input.organizationId,
    role,
    actor,
    apiTokenId,
    requestId: input.requestId,
    supabase: input.db,
  };

  return {
    auth,
    ctx,
    async close() {
      const closed = await query(input.db, "api_tokens")
        .update({ revoked_at: new Date().toISOString(), revoked_by: input.userId })
        .eq("id", apiTokenId)
        .eq("organization_id", input.organizationId)
        .eq("created_by", input.userId)
        .select("id")
        .maybeSingle();
      if (closed.error) {
        logger.error("agent-command ephemeral MCP token revoke failed", {
          error_code: closed.error.code ?? "unknown",
        });
      }
    },
  };
}

let runtime: ReturnType<typeof createAgentCommandService> | undefined;

export function getAgentCommandRuntime() {
  if (runtime) return runtime;

  const db = createAdminClient();
  runtime = createAgentCommandService({
    approvals: createApprovalRepository(),

    loadPublishedAgent: async ({ organizationId, agentId }) => {
      const agent = await query(db, "ai_agents")
        .select("id, published_version_id")
        .eq("id", agentId)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .is("archived_at", null)
        .maybeSingle();
      if (agent.error) failDatabase(agent.error);
      if (!agent.data || typeof agent.data.published_version_id !== "string") {
        return null;
      }

      const version = await query(db, "ai_agent_versions")
        .select(
          "id, agent_id, organization_id, tool_ids, operator_enabled, operator_tool_ids, status",
        )
        .eq("id", agent.data.published_version_id)
        .eq("agent_id", agentId)
        .eq("organization_id", organizationId)
        .eq("status", "published")
        .maybeSingle();
      if (version.error) failDatabase(version.error);
      if (!version.data) return null;

      return {
        agentId,
        versionId: required(version.data, "id"),
        operatorEnabled: version.data.operator_enabled === true,
        conversationalToolIds: stringList(version.data.tool_ids),
        operatorToolIds: stringList(version.data.operator_tool_ids),
      };
    },

    analyze: async ({ command }) => parseDeterministicCommand(command),

    resolveTool: (name) => {
      const tool = getToolByName(name);
      if (!tool) return null;
      const schema = z.object(tool.inputSchema as z.ZodRawShape).strict();
      return {
        name: tool.name,
        category: tool.category,
        validateArgs: (raw: unknown) => {
          const parsed = schema.safeParse(raw);
          return parsed.success
            ? { ok: true as const, data: parsed.data }
            : { ok: false as const, details: parsed.error.flatten() };
        },
      };
    },

    executeTool: async ({ organizationId, userId, toolName, args, requestId }) => {
      const tool = getToolByName(toolName);
      if (!tool) throw new Error("tool_not_found");

      const session = await createManagerMcpSession({
        db,
        organizationId,
        userId,
        requestId,
      });
      const startedAt = Date.now();
      try {
        ensureScope(session.auth.scopes, tool.requiresScope);
        ensureRole(session.auth.role, tool.requiresRole);
        const result = await tool.handler(args as never, session.ctx);
        await auditMcpToolCall({
          ctx: session.ctx,
          toolName,
          args,
          durationMs: Date.now() - startedAt,
          success: true,
        });
        return result;
      } catch (error) {
        await auditMcpToolCall({
          ctx: session.ctx,
          toolName,
          args,
          durationMs: Date.now() - startedAt,
          success: false,
          errorMessage: error instanceof Error ? error.message : "unknown_error",
        });
        throw error;
      } finally {
        await session.close();
      }
    },
  });

  return runtime;
}
