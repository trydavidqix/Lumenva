import type { SupabaseClient } from "@supabase/supabase-js";
import { auditMcpToolCall } from "@/lib/mcp/audit";
import { ensureRole, ensureScope, type McpAuthResult } from "@/lib/mcp/auth";
import { allTools } from "@/lib/mcp/tools";
import type { McpContext } from "@/lib/mcp/types";

export interface LumenvaCommand {
  toolName: string;
  args: Record<string, unknown>;
}

export function parseLumenvaArgs(argv: readonly string[]): LumenvaCommand {
  const [toolName, rawJson = "{}"] = argv;
  if (!toolName || toolName === "--help") throw new Error("usage: lumenva <tool> [json-args]");
  let args: unknown;
  try { args = JSON.parse(rawJson); } catch { throw new Error("invalid_json_args"); }
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("json_args_must_be_object");
  return { toolName, args: args as Record<string, unknown> };
}

/** CLI invokes the exact MCP tool definitions; it does not reimplement handlers. */
export async function invokeLumenvaCommand(input: {
  command: LumenvaCommand;
  auth: McpAuthResult;
  requestId: string;
  supabase: SupabaseClient;
}): Promise<unknown> {
  const tool = allTools.find((candidate) => candidate.name === input.command.toolName);
  if (!tool) throw new Error(`unknown_tool:${input.command.toolName}`);
  ensureScope(input.auth.scopes, tool.requiresScope);
  ensureRole(input.auth.role, tool.requiresRole);
  const ctx: McpContext = {
    organizationId: input.auth.organizationId,
    role: input.auth.role,
    actor: input.auth.actor,
    apiTokenId: input.auth.apiTokenId,
    requestId: input.requestId,
    supabase: input.supabase,
  };
  const startedAt = Date.now();
  try {
    const result = await tool.handler(input.command.args as never, ctx);
    await auditMcpToolCall({ ctx, toolName: tool.name, args: input.command.args, durationMs: Date.now() - startedAt, success: true });
    return result;
  } catch (error) {
    await auditMcpToolCall({ ctx, toolName: tool.name, args: input.command.args, durationMs: Date.now() - startedAt, success: false, errorMessage: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}
