import { describe, expect, it } from "vitest";

import { parseScenarioRuntimeConfig } from "./config";

describe("Scenario Lab runtime config", () => {
  it("keeps external OASIS disabled by default", () => {
    const config = parseScenarioRuntimeConfig({});
    expect(config.oasisMode).toBe("off");
    expect(config.oasisUrl).toBeNull();
  });

  it("requires a worker URL before external simulation can be enabled", () => {
    expect(() => parseScenarioRuntimeConfig({ SCENARIO_OASIS_MODE: "on" })).toThrow(/SCENARIO_OASIS_URL/);
    expect(() => parseScenarioRuntimeConfig({ SCENARIO_OASIS_MODE: "shadow" })).toThrow(/SCENARIO_OASIS_URL/);
  });

  it("bounds actors, rounds and runs", () => {
    const config = parseScenarioRuntimeConfig({
      SCENARIO_MAX_ACTORS: "50",
      SCENARIO_MAX_ROUNDS: "12",
      SCENARIO_MAX_RUNS: "25",
    });
    expect(config.maxActors).toBe(50);
    expect(config.maxRounds).toBe(12);
    expect(config.maxRuns).toBe(25);
  });
});
