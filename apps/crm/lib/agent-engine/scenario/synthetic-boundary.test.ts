import { describe, expect, it } from "vitest";

import {
  assertSyntheticArtifact,
  assertSyntheticWriteTarget,
  isScenarioSyntheticWriteTarget,
} from "./synthetic-boundary";

describe("Scenario Lab synthetic boundary", () => {
  it("allows only scenario-owned synthetic write targets", () => {
    expect(isScenarioSyntheticWriteTarget("scenario_agent_actions")).toBe(true);
    expect(isScenarioSyntheticWriteTarget("scenario_outcomes")).toBe(true);
    expect(isScenarioSyntheticWriteTarget("scenario_metrics")).toBe(true);
    expect(isScenarioSyntheticWriteTarget("scenario_reports")).toBe(true);
  });

  it("rejects authoritative CRM targets", () => {
    for (const target of ["contacts", "companies", "crm_leads", "deals", "activities", "customer_memory"]) {
      expect(isScenarioSyntheticWriteTarget(target)).toBe(false);
      expect(() => assertSyntheticWriteTarget(target)).toThrow(/synthetic write target/i);
    }
  });

  it("requires synthetic records to carry scenario and run provenance", () => {
    expect(() =>
      assertSyntheticArtifact({
        synthetic: true,
        scenarioId: "scenario-1",
        runId: "run-1",
        seed: 42,
        engineVersion: "mock@1",
      }),
    ).not.toThrow();

    expect(() =>
      assertSyntheticArtifact({
        synthetic: false,
        scenarioId: "scenario-1",
        runId: "run-1",
        seed: 42,
        engineVersion: "mock@1",
      }),
    ).toThrow(/synthetic=true/i);

    expect(() =>
      assertSyntheticArtifact({
        synthetic: true,
        scenarioId: "",
        runId: "run-1",
        seed: 42,
        engineVersion: "mock@1",
      }),
    ).toThrow(/scenario provenance/i);
  });
});
