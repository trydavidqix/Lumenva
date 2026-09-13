import { describe, expect, it } from "vitest";

import type { ScenarioEvidenceItem } from "../contracts/scenario";
import { calculateBacktestMetrics, prepareBacktestEvidence } from "./backtesting";

const evidence = (id: string, observedAt: string): ScenarioEvidenceItem => ({
  id,
  organizationId: "org-a",
  scenarioId: "scenario-a",
  sourceKind: "observed_fact",
  authority: "authoritative_crm",
  sourceType: "crm",
  sourceRef: id,
  observedAt,
  retrievedAt: observedAt,
  content: {},
  provenance: {},
});

describe("Scenario Lab backtesting", () => {
  it("prevents post-outcome evidence leakage", () => {
    const result = prepareBacktestEvidence(
      [
        evidence("before", "2026-01-01T00:00:00.000Z"),
        evidence("after", "2026-03-01T00:00:00.000Z"),
      ],
      "2026-02-01T00:00:00.000Z",
    );

    expect(result.items.map((item) => item.id)).toEqual(["before"]);
    expect(result.excludedRefs).toContain("after");
  });

  it("computes direction, magnitude, ranking and interval metrics deterministically", () => {
    const result = calculateBacktestMetrics({
      predictedValue: 120,
      observedValue: 110,
      baselineValue: 100,
      predictedRanking: ["strategy-b", "strategy-a"],
      observedRanking: ["strategy-b", "strategy-a"],
      predictedInterval: [105, 125],
    });

    expect(result.directionAccuracy).toBe(1);
    expect(result.magnitudeError).toBe(10);
    expect(result.rankingAccuracy).toBe(1);
    expect(result.intervalCoverage).toBe(1);
  });
});
