import { describe, expect, it } from "vitest";

import type { AgentDefinition } from "./agent-definition";
import { AgentDefinitionRegistry } from "./agent-definition-registry";

const certified = (overrides: Partial<AgentDefinition> = {}): AgentDefinition => ({
  id: "sales",
  version: "1.0.0",
  status: "CERTIFIED",
  identity: "Sales agent.",
  mission: "Qualify opportunities.",
  boundaries: ["No unapproved external send."],
  authority: "P0-P2 in the assigned tenant.",
  escalation: "Escalate uncertainty to a human reviewer.",
  ...overrides,
});

describe("AgentDefinitionRegistry", () => {
  it("stores and retrieves a certified definition by id and version", () => {
    const registry = new AgentDefinitionRegistry();
    const definition = certified();

    registry.register(definition);

    expect(registry.get("sales", "1.0.0")).toEqual(definition);
  });

  it("keeps versions independently addressable", () => {
    const registry = new AgentDefinitionRegistry();

    registry.register(certified({ version: "1.0.0" }));
    registry.register(certified({ version: "2.0.0", mission: "Qualify and route opportunities." }));

    expect(registry.get("sales", "1.0.0")?.mission).toBe("Qualify opportunities.");
    expect(registry.get("sales", "2.0.0")?.mission).toBe("Qualify and route opportunities.");
  });

  it("rejects SHADOW definitions and duplicate id/version entries", () => {
    const registry = new AgentDefinitionRegistry();

    expect(() => registry.register(certified({ status: "SHADOW" }))).toThrow(
      "agent_definition_not_certified",
    );
    registry.register(certified());
    expect(() => registry.register(certified())).toThrow("agent_definition_duplicate");
  });

  it("returns null for an unknown definition and protects stored boundaries", () => {
    const registry = new AgentDefinitionRegistry();
    const definition = certified();
    registry.register(definition);

    (definition.boundaries as string[])[0] = "mutated caller value";
    const loaded = registry.get("unknown", "1.0.0");

    expect(loaded).toBeNull();
    expect(registry.get("sales", "1.0.0")?.boundaries).toEqual(["No unapproved external send."]);
  });
});
