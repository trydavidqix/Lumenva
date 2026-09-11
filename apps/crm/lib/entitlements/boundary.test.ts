import { describe, expect, it } from "vitest";
import { authorizeModule, type ModuleContract } from "@/lib/entitlements/authorize-module";
import { buildEntitlementInput, entitlementRequestSchema } from "@/app/api/v1/entitlements/check/route";
import { toEntitlementReceiptView } from "@/lib/entitlements/receipt";

const moduleContract: ModuleContract = {
  id: "inbox",
  version: "1.0.0",
  dependencies: [],
  conflicts: [],
  requiredCapabilities: [],
  allowedRoles: ["agent", "manager", "admin"],
  risk: "P1",
  requiresApproval: false,
};

describe("entitlement boundary", () => {
  it("keeps the HTTP contract provider-free and defaults optional policy fields", () => {
    const parsed = entitlementRequestSchema.parse({
      module: { id: "inbox", version: "1.0.0", allowedRoles: ["agent"], risk: "P1" },
    });
    expect(parsed.enabled_modules).toEqual([]);
    expect(parsed.max_risk).toBe("P4");
    expect(parsed.approval).toEqual({ required: false, approved: false });
  });

  it("fails closed with an auditable DENY receipt when the module is not entitled", () => {
    const decision = authorizeModule({
      requestId: "req-deny",
      policyVersion: "entitlements.v1",
      module: moduleContract,
      tenant: {
        organizationId: "org-a",
        rlsOrganizationId: "org-a",
        rlsAllowed: true,
        plan: "standard",
        entitledModules: [],
      },
      actor: {
        actorId: "user-a",
        organizationId: "org-a",
        role: "agent",
        capabilities: [],
      },
      enabledModules: [],
      maxRisk: "P4",
      approval: { required: false, approved: false },
    });

    expect(decision).toMatchObject({ decision: "DENY", reason: "module_not_entitled" });
    expect(toEntitlementReceiptView(decision)).toMatchObject({ status: "denied", reason: "module_not_entitled", requestId: "req-deny", moduleId: "inbox" });
    expect(decision.audit.checks).toEqual([
      { stage: "tenant_rls", result: "PASS" },
      { stage: "entitlement", result: "FAIL", reason: "module_not_entitled" },
    ]);
  });

  it("builds server input from trusted context without accepting a client plan", () => {
    const input = buildEntitlementInput({
      requestId: "req-http",
      policyVersion: "entitlements.v1",
      module: moduleContract,
      organizationId: "org-a",
      plan: "pro",
      entitledModules: ["inbox"],
      actorId: "user-a",
      role: "agent",
      enabledModules: ["inbox"],
      maxRisk: "P4",
      approval: { required: false, approved: false },
    });

    expect(input.tenant.plan).toBe("pro");
    expect(input.tenant.organizationId).toBe("org-a");
    expect(input.actor.organizationId).toBe("org-a");
    expect(authorizeModule(input).decision).toBe("ALLOW");
  });
});
