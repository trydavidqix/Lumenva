/**
 * Wave 1 MCP surface for CRM operating-core resources.
 *
 * These adapters are read-only and deliberately reuse the MCP server's
 * existing auth/scope boundary. They query canonical CRM tables with the
 * tenant supplied by McpContext; policy, idempotency and evidence remain owned
 * by the existing Agent OS/runtime contracts.
 */
import { z } from "zod";
import type { McpToolDefinition } from "../types";

const listInputShape = {
  include_archived: z.boolean().optional().default(false),
};

export const crmListAgents: McpToolDefinition<typeof listInputShape> = {
  name: "crm_list_agents",
  description: "Lista agentes configurados na organização do token.",
  inputSchema: listInputShape,
  category: "read",
  requiresRole: "manager",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    let query = ctx.supabase
      .from("ai_agents")
      .select(
        "id, organization_id, name, description, kind, priority, is_active, is_default, published_version_id, archived_at, created_at, updated_at",
      )
      .eq("organization_id", ctx.organizationId);

    if (!input.include_archived) query = query.is("archived_at", null);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return { agents: data ?? [] };
  },
};

const jobsInputShape = {
  status: z.enum(["pending", "running", "done", "failed", "dead"]).optional(),
  limit: z.number().int().min(1).max(100).default(50),
};

export const crmListJobs: McpToolDefinition<typeof jobsInputShape> = {
  name: "crm_list_jobs",
  description:
    "Lista jobs do Agent OS da organização, sem devolver payload ou conteúdo potencialmente sensível.",
  inputSchema: jobsInputShape,
  category: "read",
  requiresRole: "manager",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    let query = ctx.supabase
      .from("job_queue")
      .select(
        "id, organization_id, contact_id, kind, status, priority, run_after, attempts, max_attempts, last_error, locked_by, locked_at, created_at",
      )
      .eq("organization_id", ctx.organizationId)
      .order("created_at", { ascending: false })
      .limit(input.limit);

    if (input.status) query = query.eq("status", input.status);

    const { data, error } = await query;
    if (error) throw error;
    return { jobs: data ?? [] };
  },
};

const approvalsInputShape = {
  status: z
    .enum(["pending", "approved", "denied", "executing", "executed", "expired", "failed"])
    .optional(),
  limit: z.number().int().min(1).max(100).default(50),
};

export const crmListApprovals: McpToolDefinition<typeof approvalsInputShape> = {
  name: "crm_list_approvals",
  description:
    "Lista pedidos de aprovação do Agent OS da organização, sem devolver argumentos ou resultados de execução.",
  inputSchema: approvalsInputShape,
  category: "read",
  requiresRole: "manager",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    let query = ctx.supabase
      .from("ai_agent_command_approvals")
      .select(
        "id, organization_id, agent_id, agent_version_id, trace_id, tool_name, request_hash, idempotency_key, reason, status, expires_at, decided_at, decided_by, decision_reason, executed_at, error_code, created_at",
      )
      .eq("organization_id", ctx.organizationId)
      .order("created_at", { ascending: false })
      .limit(input.limit);

    if (input.status) query = query.eq("status", input.status);

    const { data, error } = await query;
    if (error) throw error;
    return { approvals: data ?? [] };
  },
};
