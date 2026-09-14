import { describe, expect, it, vi } from "vitest";

const { auth, supabase, audit } = vi.hoisted(() => ({
  auth: {
    organizationId: "org-a", role: "agent" as const,
    actor: { type: "user" as const, id: "actor-a", role: "agent" as const },
    apiTokenId: "token-a", scopes: ["mcp:read", "mcp:write"],
  },
  supabase: {} as Record<string, unknown>,
  audit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/mcp/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/mcp/auth")>("@/lib/mcp/auth");
  return { ...actual, validateBearerToken: vi.fn().mockResolvedValue(auth) };
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => supabase) }));
vi.mock("@/lib/mcp/audit", () => ({ auditMcpToolCall: audit }));
vi.mock("@/lib/auth/server", () => ({ loadAuthUser: vi.fn(), resolveActiveOrg: vi.fn() }));

import { POST } from "@/app/api/v1/mcp/tools/route";
import { invokeLumenvaCommand, validateLumenvaToolArgs } from "@/lib/cli/lumenva";
import { crmListImprovementProposals } from "@/lib/mcp/tools/evolucao";

function queryReturning(data: unknown) {
  const query = {
    select: vi.fn(() => query), eq: vi.fn(() => query), order: vi.fn(() => query), limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
  };
  return query;
}

describe("MCP HTTP execution equivalence", () => {
  it("returns the same handler result through HTTP, CLI and direct MCP", async () => {
    const args = { limite: 5 };
    const rows = [{ id: "proposal-1", evidence: { source: "fixture", confidence: 0.91 } }];
    const query = queryReturning(rows);
    (supabase as { from?: unknown }).from = vi.fn(() => query);
    const ctx = { organizationId: auth.organizationId, role: auth.role, actor: auth.actor, apiTokenId: auth.apiTokenId, requestId: "req-equivalence", supabase } as never;
    const direct = await crmListImprovementProposals.handler(validateLumenvaToolArgs("crm_list_improvement_proposals", args) as never, ctx);
    const cli = await invokeLumenvaCommand({ command: { toolName: "crm_list_improvement_proposals", args }, auth, requestId: "req-equivalence", supabase: supabase as never });
    const response = await POST(new Request("http://localhost/api/v1/mcp/tools", { method: "POST", headers: { authorization: "Bearer dsk_fixture" }, body: JSON.stringify({ toolName: "crm_list_improvement_proposals", args }) }) as never);
    expect(response.status).toBe(200);
    const http = await response.json();
    expect(http.data.result).toEqual(direct);
    expect(cli).toEqual(direct);
  });

  it("rejects a cross-tenant body even when the caller supplies another organization", async () => {
    const response = await POST(new Request("http://localhost/api/v1/mcp/tools", { method: "POST", headers: { authorization: "Bearer dsk_fixture" }, body: JSON.stringify({ organizationId: "org-b", toolName: "crm_list_improvement_proposals", args: { limite: 5 } }) }) as never);
    expect(response.status).toBe(403);
  });
});
