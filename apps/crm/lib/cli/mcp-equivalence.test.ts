import { describe, expect, it, vi } from "vitest";

const { auditSpy } = vi.hoisted(() => ({
  auditSpy: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/mcp/audit", () => ({ auditMcpToolCall: auditSpy }));

import { invokeLumenvaCommand, validateLumenvaToolArgs } from "@/lib/cli/lumenva";
import { allTools } from "@/lib/mcp/tools";
import { crmListImprovementProposals } from "@/lib/mcp/tools/evolucao";
import { crmSendWhatsappMessage } from "@/lib/mcp/tools/messages";

const organizationId = "11111111-1111-4111-8111-111111111111";
const auth = {
  organizationId,
  role: "agent" as const,
  actor: { type: "user" as const, id: "22222222-2222-4222-8222-222222222222", role: "agent" as const },
  apiTokenId: "token-1",
  scopes: ["mcp:read", "mcp:write"],
};

function queryReturning(data: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve),
  };
  return query;
}

describe("MCP/CLI operating-core equivalence", () => {
  it("uses the same MCP registry metadata for auth and policy", () => {
    for (const name of [
      "crm_list_improvement_proposals",
      "crm_send_whatsapp_message",
    ]) {
      const tool = allTools.find((candidate) => candidate.name === name);
      expect(tool).toBeDefined();
      expect(tool?.requiresScope).toMatch(/^mcp:(read|write)$/);
      expect(tool?.requiresRole).toMatch(/^(agent|manager)$/);
      expect(tool?.inputSchema).toBeDefined();
    }
  });

  it("fails closed on the MCP scope policy before invoking a CLI write", async () => {
    auditSpy.mockClear();
    await expect(
      invokeLumenvaCommand({
        command: {
          toolName: "crm_send_whatsapp_message",
          args: {
            conversation_id: "33333333-3333-4333-8333-333333333333",
            body: "blocked",
            idempotency_key: "run-1-step-2",
          },
        },
        auth: { ...auth, scopes: ["mcp:read"] },
        requestId: "req-policy",
        supabase: {} as never,
      }),
    ).rejects.toThrow("Token missing required scope");
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "crm_send_whatsapp_message",
        success: false,
      }),
    );
  });

  it("preserves idempotent cached results through CLI and direct MCP handler", async () => {
    const args = {
      conversation_id: "33333333-3333-4333-8333-333333333333",
      body: "não deve enviar novamente",
      idempotency_key: "run-1-step-1",
    };
    const cached = { message_id: "message-1", status: "sent" };
    const query = queryReturning({ response_body: cached });
    const supabase = { from: vi.fn(() => query) } as never;
    const ctx = {
      organizationId,
      role: "agent" as const,
      actor: auth.actor,
      apiTokenId: auth.apiTokenId,
      requestId: "req-1",
      supabase,
    };

    const direct = await crmSendWhatsappMessage.handler(
      validateLumenvaToolArgs("crm_send_whatsapp_message", args) as never,
      ctx,
    );
    const cli = await invokeLumenvaCommand({
      command: { toolName: "crm_send_whatsapp_message", args },
      auth,
      requestId: "req-1",
      supabase,
    });

    expect(direct).toEqual({ ...cached, deduplicated: true });
    expect(cli).toEqual(direct);
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: "crm_send_whatsapp_message", success: true }),
    );
  });

  it("preserves evidence fields through CLI and direct MCP handler", async () => {
    const evidence = { source: "fixture", confidence: 0.91 };
    const rows = [{ id: "proposal-1", evidence }];
    const query = queryReturning(rows);
    const supabase = { from: vi.fn(() => query) } as never;
    const args = { limite: 5 };
    const ctx = {
      organizationId,
      role: "agent" as const,
      actor: auth.actor,
      apiTokenId: auth.apiTokenId,
      requestId: "req-2",
      supabase,
    };

    const direct = await crmListImprovementProposals.handler(
      validateLumenvaToolArgs("crm_list_improvement_proposals", args) as never,
      ctx,
    );
    const cli = await invokeLumenvaCommand({
      command: { toolName: "crm_list_improvement_proposals", args },
      auth,
      requestId: "req-2",
      supabase,
    });

    expect(direct).toEqual({ propostas: rows });
    expect(cli).toEqual(direct);
    expect(cli).toMatchObject({ propostas: [{ evidence }] });
  });
});
