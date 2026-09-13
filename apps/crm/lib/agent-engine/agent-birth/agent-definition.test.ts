import { describe, expect, it } from "vitest";

import {
  validateAgentDefinition,
  type AgentDefinitionOrigin,
  type AgentDefinitionInput,
} from "./agent-definition";

const validDefinition: AgentDefinitionInput = {
  id: "sales",
  version: "1.0.0",
  identity: "Sales agent for the tenant CRM.",
  mission: "Qualify inbound opportunities and prepare a next step.",
  boundaries: ["No external send without approval.", "No cross-tenant access."],
  authority: "P0-P2 within the assigned tenant and approved tools.",
  escalation: "Escalate policy, safety, scope or approval uncertainty to a human reviewer.",
};

const validOrigin: AgentDefinitionOrigin = {
  actor_id: "owner-1",
  tenant_id: "tenant-a",
};

const expectedTenantId = "tenant-a";

describe("AgentDefinition validation", () => {
  it("certifies a definition when all canonical birth fields are populated", () => {
    const result = validateAgentDefinition(validDefinition, validOrigin, expectedTenantId);

    expect(result).toEqual({
      ok: true,
      status: "CERTIFIED",
      definition: validDefinition,
      errors: [],
    });
  });

  it.each(["identity", "mission", "authority", "escalation"] as const)(
    "keeps an agent in SHADOW when %s is missing",
    (field) => {
      const candidate = { ...validDefinition, [field]: "   " };

      const result = validateAgentDefinition(candidate, validOrigin, expectedTenantId);

      expect(result.ok).toBe(false);
      expect(result.status).toBe("SHADOW");
      expect(result.errors).toContain(`${field}_required`);
    },
  );

  it("keeps an agent in SHADOW when boundaries are absent or empty", () => {
    const result = validateAgentDefinition({
      ...validDefinition,
      boundaries: [],
    }, validOrigin, expectedTenantId);

    expect(result).toEqual({
      ok: false,
      status: "SHADOW",
      definition: null,
      errors: ["boundaries_required"],
    });
  });

  it("fails closed for malformed input without throwing", () => {
    const result = validateAgentDefinition(null, validOrigin, expectedTenantId);

    expect(result).toEqual({
      ok: false,
      status: "SHADOW",
      definition: null,
      errors: ["definition_required"],
    });
  });

  it("keeps an agent in SHADOW when origin is absent", () => {
    const result = validateAgentDefinition(
      validDefinition,
      undefined as unknown as AgentDefinitionOrigin,
      expectedTenantId,
    );

    expect(result).toEqual({
      ok: false,
      status: "SHADOW",
      definition: null,
      errors: ["origin_required"],
    });
  });

  it("keeps an agent in SHADOW when origin tenant does not match context", () => {
    const result = validateAgentDefinition(
      validDefinition,
      { ...validOrigin, tenant_id: "tenant-b" },
      expectedTenantId,
    );

    expect(result).toEqual({
      ok: false,
      status: "SHADOW",
      definition: null,
      errors: ["origin_tenant_mismatch"],
    });
  });

  it("keeps an agent in SHADOW when origin actor or tenant is empty", () => {
    const result = validateAgentDefinition(
      validDefinition,
      { actor_id: " ", tenant_id: " " },
      expectedTenantId,
    );

    expect(result).toEqual({
      ok: false,
      status: "SHADOW",
      definition: null,
      errors: ["origin_actor_required", "origin_tenant_required"],
    });
  });
});
