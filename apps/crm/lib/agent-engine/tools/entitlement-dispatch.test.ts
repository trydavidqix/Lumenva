import { describe, expect, it } from "vitest";
import { executeThroughEntitledToolGateway } from "@/lib/agent-engine/tools/gateway";
import type { AgentToolDefinition } from "@/lib/agent-engine/tools/registry";
import type { AuthorizeModuleInput } from "@/lib/entitlements/authorize-module";

const entitlement: AuthorizeModuleInput = {
  requestId: "dispatch-deny",
  policyVersion: "entitlements.v1",
  module: { id: "inbox", version: "1.0.0", dependencies: [], conflicts: [], requiredCapabilities: [], allowedRoles: ["agent"], risk: "P1", requiresApproval: false },
  tenant: { organizationId: "org-a", rlsOrganizationId: "org-a", rlsAllowed: true, plan: "standard", entitledModules: [] },
  actor: { actorId: "agent-a", organizationId: "org-a", role: "agent", capabilities: [] },
  enabledModules: [], maxRisk: "P4", approval: { required: false, approved: false },
};
const tool: AgentToolDefinition = {
  id: "inbox", owner: "test", source: "internal", schema: { kind: "inline", value: {} },
  risk: "r0_read", hasSideEffect: false, idempotencyRequired: false, timeoutMs: 1000, maxRetries: 0,
};

describe("dispatch entitlement boundary", () => {
  it("returns a DENY receipt before executing an unentitled tool", async () => {
    let executed = false;
    const result = await executeThroughEntitledToolGateway({
      organizationId: "org-a", agentId: "agent-a", autonomyLevel: "assisted", tool, args: {}, idempotencyKey: "dispatch-1", approvalStore: null,
      entitlement,
      execute: async () => { executed = true; return "ok"; },
    });
    expect(result.kind).toBe("denied");
    expect(result).toMatchObject({ reason: "entitlement:module_not_entitled", receipt: { decision: "DENY", reason: "module_not_entitled" } });
    expect(executed).toBe(false);
  });
});


it("refuses dispatch when the central entitlement context is missing", async () => {
  let executed = false;
  const result = await executeThroughEntitledToolGateway({
    organizationId: "org-a", agentId: "agent-a", autonomyLevel: "assisted", tool, args: {}, idempotencyKey: "missing-entitlement", approvalStore: null,
    execute: async () => { executed = true; return "ok"; },
  } as never);
  expect(result).toMatchObject({ kind: "denied", reason: "entitlement:authorization_contract_invalid", receipt: { decision: "DENY" } });
  expect(executed).toBe(false);
});
