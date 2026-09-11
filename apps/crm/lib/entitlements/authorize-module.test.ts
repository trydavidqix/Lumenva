import { describe, expect, it } from "vitest";
import { authorizeModule, type AuthorizeModuleInput } from "./authorize-module";

const moduleContract = {
  id: "inbox",
  version: "1.0.0",
  dependencies: [],
  conflicts: [],
  requiredCapabilities: ["inbox.read"],
  allowedRoles: ["admin", "manager"],
  risk: "P1" as const,
  requiresApproval: false,
};

function request(overrides: Partial<AuthorizeModuleInput> = {}): AuthorizeModuleInput {
  return {
    requestId: "req-1",
    policyVersion: "entitlements-v1",
    module: moduleContract,
    tenant: {
      organizationId: "tenant-a",
      rlsOrganizationId: "tenant-a",
      rlsAllowed: true,
      plan: "pro",
      entitledModules: ["inbox"],
    },
    actor: {
      actorId: "user-a",
      organizationId: "tenant-a",
      role: "manager",
      capabilities: ["inbox.read"],
    },
    enabledModules: ["inbox"],
    maxRisk: "P2",
    approval: { required: false, approved: false },
    ...overrides,
  };
}

describe("authorizeModule", () => {
  it("allows an entitled module for tenant A and records the ordered audit trail", () => {
    const result = authorizeModule(request());
    expect(result.decision).toBe("ALLOW");
    if (result.decision === "ALLOW") {
      expect(result.policyVersion).toBe("entitlements-v1");
      expect(result.audit.organizationId).toBe("tenant-a");
      expect(result.audit.checks.map((check) => check.stage)).toEqual([
        "tenant_rls",
        "entitlement",
        "dependencies_conflicts",
        "capability_role",
        "risk",
        "approval",
      ]);
    }
  });

  it("denies the same module for tenant B on the free plan before capability checks", () => {
    const result = authorizeModule(request({
      tenant: {
        organizationId: "tenant-b",
        rlsOrganizationId: "tenant-b",
        rlsAllowed: true,
        plan: "free",
        entitledModules: [],
      },
      actor: { actorId: "user-b", organizationId: "tenant-b", role: "manager", capabilities: ["inbox.read"] },
    }));
    expect(result).toMatchObject({ decision: "DENY", reason: "module_not_entitled", policyVersion: "entitlements-v1" });
    if (result.decision === "DENY") expect(result.audit.checks.map((check) => check.stage)).toEqual(["tenant_rls", "entitlement"]);
  });

  it("denies cross-tenant RLS even when the actor has the capability and plan entitlement", () => {
    const result = authorizeModule(request({
      tenant: { ...request().tenant, organizationId: "tenant-a", rlsOrganizationId: "tenant-b" },
      actor: { actorId: "user-b", organizationId: "tenant-b", role: "manager", capabilities: ["inbox.read"] },
    }));
    expect(result).toMatchObject({ decision: "DENY", reason: "tenant_rls_denied" });
  });

  it("cannot elevate a missing capability into ALLOW", () => {
    const result = authorizeModule(request({ actor: { ...request().actor, capabilities: [] } }));
    expect(result).toMatchObject({ decision: "DENY", reason: "capability_missing" });
    expect(result.decision).not.toBe("ALLOW");
  });

  it("fails closed for an invalid P9 module risk and max-risk policy", () => {
    const invalidModule = authorizeModule(request({
      module: { ...moduleContract, risk: "P9" as never },
    }));
    expect(invalidModule).toMatchObject({ decision: "DENY", reason: "authorization_contract_invalid", policyVersion: "entitlements-v1" });
    if (invalidModule.decision === "DENY") {
      expect(invalidModule.audit.checks).toEqual([]);
    }

    const invalidPolicy = authorizeModule(request({ maxRisk: "P9" as never }));
    expect(invalidPolicy).toMatchObject({ decision: "DENY", reason: "risk_contract_invalid", policyVersion: "entitlements-v1" });
    if (invalidPolicy.decision === "DENY") {
      expect(invalidPolicy.audit.checks.at(-1)).toEqual({ stage: "risk", result: "FAIL", reason: "risk_contract_invalid" });
    }
  });

  it("enforces dependencies, risk and approval after earlier gates", () => {
    const result = authorizeModule(request({
      module: { ...moduleContract, dependencies: ["contacts"], risk: "P3", requiresApproval: true },
      enabledModules: ["inbox"],
      maxRisk: "P2",
      approval: { required: false, approved: false },
    }));
    expect(result).toMatchObject({ decision: "DENY", reason: "dependency_missing" });
  });
});
