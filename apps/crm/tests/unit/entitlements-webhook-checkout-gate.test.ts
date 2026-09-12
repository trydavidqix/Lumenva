import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { authorizeModule, type AuthorizeModuleInput } from "@/lib/entitlements/authorize-module";
import { authorizeModuleForContext, type EntitlementRequest } from "@/lib/entitlements/adapter";

const moduleRequest = (overrides: Partial<EntitlementRequest> = {}): EntitlementRequest => ({
  module: { id: "contacts", version: "1", dependencies: [], conflicts: [], requiredCapabilities: [], allowedRoles: ["agent", "manager", "admin"], risk: "P4", requiresApproval: false },
  enabled_modules: [], max_risk: "P4", approval: { required: false, approved: false }, ...overrides,
});

const decision = (input: { plan: string; entitledModules: string[]; capabilities?: string[]; request?: EntitlementRequest }) => authorizeModuleForContext({
  requestId: `qa-${input.plan}`,
  organizationId: "org-a",
  actorId: "user-a",
  role: "agent",
  capabilities: input.capabilities,
  plan: input.plan,
  entitledModules: input.entitledModules,
  request: input.request ?? moduleRequest(),
});

const centralInput = (overrides: Partial<AuthorizeModuleInput> = {}): AuthorizeModuleInput => ({
  requestId: "qa-tenant",
  policyVersion: "entitlements.v1",
  module: moduleRequest().module,
  tenant: { organizationId: "org-a", rlsOrganizationId: "org-a", rlsAllowed: true, plan: "premium", entitledModules: ["contacts"] },
  actor: { actorId: "user-a", organizationId: "org-a", role: "agent", capabilities: [] },
  enabledModules: [], maxRisk: "P4", approval: { required: false, approved: false }, ...overrides,
});

describe("Etapa 3 provider-free entitlement matrix", () => {
  it.each([["premium", ["contacts"], "ALLOW"], ["basic", [], "DENY"], ["medium", [], "DENY"]] as const)("authorizes module only from the server catalog: %s -> %s", (plan, entitledModules, expected) => {
    expect(decision({ plan, entitledModules }).decision).toBe(expected);
  });

  it("denies cross-tenant context before entitlement", () => {
    const result = authorizeModule(centralInput({ actor: { ...centralInput().actor, organizationId: "org-b" } }));
    expect(result).toMatchObject({ decision: "DENY", reason: "tenant_rls_denied" });
  });

  it("does not let a capability bypass a missing entitlement", () => {
    const result = authorizeModule(centralInput({
      tenant: { ...centralInput().tenant, entitledModules: [] },
      actor: { ...centralInput().actor, capabilities: ["contacts:read", "billing:admin"] },
      module: { ...centralInput().module, requiredCapabilities: ["contacts:read"] },
    }));
    expect(result).toMatchObject({ decision: "DENY", reason: "module_not_entitled" });
  });

  it("requires provider webhook and checkout adapters to delegate to the central boundary", () => {
    const roots = ["apps/crm/app/api/v1/stripe/webhook/route.ts", "apps/crm/app/api/v1/stripe/checkout/route.ts"];
    for (const relative of roots) {
      expect(existsSync(join(process.cwd(), relative)), `${relative} is missing`).toBe(true);
      const source = readFileSync(join(process.cwd(), relative), "utf8");
      expect(source).toMatch(/authorizeModuleForContext|authorizeModule/);
      expect(source).toMatch(/organizationId/);
      expect(source).toMatch(/idempot|event_id|eventId/);
      expect(source).toMatch(/signature|sig_header|stripe-signature/);
      expect(source).not.toMatch(/req\.body\.(plan|module|entitledModules)/);
    }
  });

  it("requires database idempotency to be tenant-scoped", () => {
    const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260911100000_0161_entitlements_catalog.sql"), "utf8");
    expect(migration).toMatch(/unique \(organization_id, idempotency_key\)/i);
    expect(migration).toMatch(/alter table public.entitlement_events enable row level security/i);
  });
});
