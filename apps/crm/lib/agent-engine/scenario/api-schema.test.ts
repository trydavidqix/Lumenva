import { describe, expect, it } from "vitest";

import { parseCreateScenarioInput, parseUpdateScenarioInput } from "./api-schema";

describe("Scenario Lab API schemas", () => {
  it("builds bounded defaults without accepting tenant identity from payloads", () => {
    const parsed = parseCreateScenarioInput(
      { question: "What happens if we change the price?", organizationId: "attacker-org" },
      { maxRuns: 25, maxRuntimeMs: 120_000 },
    );
    expect(parsed.question).toMatch(/price/);
    expect(parsed).not.toHaveProperty("organizationId");
    expect(parsed.budget.maxSimulationRuns).toBeLessThanOrEqual(25);
  });

  it("rejects empty updates and unknown fields", () => {
    expect(() => parseUpdateScenarioInput({})).toThrow();
    expect(() => parseUpdateScenarioInput({ status: "COMPLETED" })).toThrow();
  });
});
