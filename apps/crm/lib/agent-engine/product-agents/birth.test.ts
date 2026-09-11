import { describe, expect, it } from "vitest";
import {
  AgentBirthError,
  AgentFactory,
  FIRST_BIRTH_CONTRACTS,
  InMemoryAgentDefinitionVersionStore,
  birthFirstPartyAgents,
} from "./birth";

describe("Agent Factory birth pipeline", () => {
  it("births the first Sales, Support and Claude Orchestrator contracts deterministically", async () => {
    const store = new InMemoryAgentDefinitionVersionStore();
    const factory = new AgentFactory(store, () => "2026-09-11T00:00:00.000Z");

    const first = await birthFirstPartyAgents(factory);
    const second = await birthFirstPartyAgents(factory);

    expect(first.map((entry) => entry.definition.id)).toEqual([
      "sales",
      "support",
      "claude_orchestrator",
    ]);
    expect(first.map((entry) => entry.contentHash)).toEqual(
      second.map((entry) => entry.contentHash),
    );
    expect(first.every((entry) => entry.definition.version === "1.0.0")).toBe(true);
    expect(first.every((entry) => entry.provenance.sourceRef.length > 0)).toBe(true);
  });

  it("rejects model/provider in identity and keeps the error fail-closed", async () => {
    const factory = new AgentFactory(new InMemoryAgentDefinitionVersionStore());
    await expect(
      factory.birth({
        ...FIRST_BIRTH_CONTRACTS[0],
        model: "claude-sonnet",
      }),
    ).rejects.toMatchObject({
      code: "identity_contains_provider",
      message: "agent_identity_must_not_contain_model_or_provider",
    });
  });

  it("rejects conflicting content for an already stored version", async () => {
    const store = new InMemoryAgentDefinitionVersionStore();
    const factory = new AgentFactory(store);
    const original = FIRST_BIRTH_CONTRACTS[0]!;
    await factory.birth(original);

    await expect(
      factory.birth({
        ...original,
        definition: { ...original.definition, objective: "different" },
      }),
    ).rejects.toThrow(new AgentBirthError("version_conflict", "agent_definition_version_conflict"));
  });
});
