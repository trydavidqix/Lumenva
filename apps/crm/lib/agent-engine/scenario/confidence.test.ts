import { describe, expect, it } from "vitest";

import { calculateScenarioConfidence } from "./confidence";

describe("calculateScenarioConfidence", () => {
  it("derives confidence from inspectable components rather than model self-report", () => {
    const result = calculateScenarioConfidence({
      runStability: 0.9,
      evidenceCoverage: 0.8,
      modelAgreement: 0.7,
      sensitivityStability: 0.85,
      historicalCalibration: 0.75,
      engineReliability: 0.95,
      dataFreshness: 0.9,
    });

    expect(result.formulaVersion).toBe("scenario-confidence@1");
    expect(result.composite).not.toBeNull();
    expect(result.composite!).toBeGreaterThan(0.7);
    expect(result.components.historicalCalibration).toBe(0.75);
  });

  it("does not invent historical calibration when no backtest exists", () => {
    const result = calculateScenarioConfidence({
      runStability: 0.8,
      evidenceCoverage: 0.8,
      modelAgreement: 0.8,
      sensitivityStability: 0.8,
      historicalCalibration: null,
      engineReliability: 0.8,
      dataFreshness: 0.8,
    });

    expect(result.components.historicalCalibration).toBeNull();
    expect(result.reasons.some((reason) => /historical calibration unavailable/i.test(reason))).toBe(true);
  });

  it("rejects values outside zero-to-one", () => {
    expect(() =>
      calculateScenarioConfidence({
        runStability: 1.1,
        evidenceCoverage: 0.8,
        modelAgreement: 0.8,
        sensitivityStability: 0.8,
        historicalCalibration: null,
        engineReliability: 0.8,
        dataFreshness: 0.8,
      }),
    ).toThrow(/between 0 and 1/i);
  });
});
