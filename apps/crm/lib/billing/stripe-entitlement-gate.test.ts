import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { authorizeModule } from "../entitlements/authorize-module";

const checkoutSource = () => readFileSync(join(process.cwd(), "apps/crm/lib/billing/stripe-checkout.ts"), "utf8");
const sourceAt = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const centralInput = (overrides: Record<string, unknown> = {}) => ({
  requestId: "qa-stripe-gate",
  policyVersion: "entitlements.v1",
  module: { id: "contacts", version: "1", dependencies: [], conflicts: [], requiredCapabilities: [], allowedRoles: ["agent", "manager", "admin"], risk: "P4" as const, requiresApproval: false },
  tenant: { organizationId: "org-a", rlsOrganizationId: "org-a", rlsAllowed: true, plan: "premium", entitledModules: ["contacts"] },
  actor: { actorId: "user-a", organizationId: "org-a", role: "agent", capabilities: [] },
  enabledModules: [], maxRisk: "P4" as const,
  approval: { required: false, approved: false },
  ...overrides,
});

describe("Stripe entitlement integration gate", () => {
  it("keeps the central authorizeModule decision semantics provider-free", () => {
    expect(authorizeModule(centralInput()).decision).toBe("ALLOW");
    expect(authorizeModule(centralInput({ tenant: { ...centralInput().tenant, entitledModules: [] } } as never)).reason).toBe("module_not_entitled");
    expect(authorizeModule(centralInput({ actor: { ...centralInput().actor, organizationId: "org-b" } } as never)).reason).toBe("tenant_rls_denied");
    expect(authorizeModule(centralInput({ tenant: { ...centralInput().tenant, entitledModules: [] }, actor: { ...centralInput().actor, capabilities: ["contacts:read"] }, module: { ...centralInput().module, requiredCapabilities: ["contacts:read"] } } as never)).reason).toBe("module_not_entitled");
  });

  it("requires checkout to call authorizeModule centrally before the provider adapter", () => {
    const source = checkoutSource();
    expect(source).toMatch(/from ["']\.\.\/entitlements\/authorize-module["']/);
    expect(source).toMatch(/authorizeModule\(/);
    expect(source).toMatch(/organizationId/);
    expect(source).not.toMatch(/productId|priceId/);
  });

  it.each([
    "apps/crm/app/api/v1/stripe/checkout/route.ts",
    "apps/crm/app/api/v1/stripe/webhook/route.ts",
  ])("requires a runtime Stripe route: %s", (relative) => {
    expect(existsSync(join(process.cwd(), relative)), `${relative} is missing`).toBe(true);
  });

  it("requires checkout route input to ignore browser-supplied entitlement state", () => {
    const source = sourceAt("apps/crm/app/api/v1/stripe/checkout/route.ts");
    expect(source).toMatch(/authorizeModuleForContext|authorizeModule/);
    expect(source).not.toMatch(/body\.(plan|planSlug|module|entitledModules|capabilities)/);
  });

  it("requires webhook route signature, tenant, idempotency, and central authorization", () => {
    const source = sourceAt("apps/crm/app/api/v1/stripe/webhook/route.ts");
    expect(source).toMatch(/stripe-signature|signature|constructEvent/);
    expect(source).toMatch(/eventId|event_id|idempot/);
    expect(source).toMatch(/organizationId|tenant_id|tenantId/);
    expect(source).toMatch(/authorizeModuleForContext|authorizeModule/);
  });
});
