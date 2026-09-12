import { describe, expect, it } from "vitest";

import {
  validateAgentDefinition,
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

describe("AgentDefinition validation", () => {
  it("certifies a definition when all canonical birth fields are populated", () => {
    const result = validateAgentDefinition(validDefinition);

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

      const result = validateAgentDefinition(candidate);

      expect(result.ok).toBe(false);
      expect(result.status).toBe("SHADOW");
      expect(result.errors).toContain(`${field}_required`);
    },
  );

  it("keeps an agent in SHADOW when boundaries are absent or empty", () => {
    const result = validateAgentDefinition({
      ...validDefinition,
      boundaries: [],
    });

    expect(result).toEqual({
      ok: false,
      status: "SHADOW",
      definition: null,
      errors: ["boundaries_required"],
    });
  });

  it("fails closed for malformed input without throwing", () => {
    const result = validateAgentDefinition(null);

    expect(result).toEqual({
      ok: false,
      status: "SHADOW",
      definition: null,
      errors: ["definition_required"],
    });
  });
});
