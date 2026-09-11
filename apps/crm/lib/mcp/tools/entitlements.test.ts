import { describe, expect, it } from "vitest";
import { invokeLumenvaCommand } from "@/lib/cli/lumenva";
import { getToolByName } from "@/lib/mcp/tools";

const moduleContract = {
  id: "inbox", version: "1.0.0", dependencies: [], conflicts: [], requiredCapabilities: [],
  allowedRoles: ["agent"], risk: "P1" as const, requiresApproval: false,
};
const args = { module: moduleContract, enabled_modules: [], max_risk: "P4" as const, approval: { required: false, approved: false } };
function fakeSupabase(entitledModules: string[]) {
  return { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { settings: { plan: "pro", entitled_modules: entitledModules } }, error: null }) }) }) }) };
}
const auth = { organizationId: "org-1", role: "agent" as const, actor: { type: "user" as const, id: "user-1", role: "agent" as const }, apiTokenId: "token-1", scopes: ["mcp:read"] };
const ctx = { organizationId: "org-1", role: "agent" as const, actor: auth.actor, apiTokenId: "token-1", requestId: "req-equivalence", supabase: fakeSupabase(["inbox"]) as never };

describe("crm_authorize_module MCP/CLI equivalence", () => {
  it("returns equivalent ALLOW decision through the shared MCP tool and CLI invoker", async () => {
    const tool = getToolByName("crm_authorize_module");
    expect(tool).toBeDefined();
    const mcp = await tool!.handler(args as never, ctx as never);
    const cli = await invokeLumenvaCommand({ command: { toolName: "crm_authorize_module", args }, auth, requestId: "req-equivalence", supabase: fakeSupabase(["inbox"]) as never });
    expect(mcp).toEqual(cli);
    expect(mcp).toMatchObject({ decision: "ALLOW", receipt: { requestId: "req-equivalence", moduleId: "inbox" } });
  });

  it("returns equivalent DENY decision and reason without executing side effects", async () => {
    const tool = getToolByName("crm_authorize_module");
    const mcp = await tool!.handler(args as never, { ...ctx, supabase: fakeSupabase([]) } as never);
    const cli = await invokeLumenvaCommand({ command: { toolName: "crm_authorize_module", args }, auth, requestId: "req-equivalence", supabase: fakeSupabase([]) as never });
    expect(mcp).toEqual(cli);
    expect(mcp).toMatchObject({ decision: "DENY", reason: "module_not_entitled", receipt: { checks: [{ stage: "tenant_rls", result: "PASS" }, { stage: "entitlement", result: "FAIL" }] } });
  });
});
