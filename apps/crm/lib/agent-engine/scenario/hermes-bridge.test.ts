import { describe, expect, it, vi } from "vitest";

import { createHermesLearningCandidate } from "./hermes-bridge";

describe("Scenario Lab Hermes bridge", () => {
  it("creates only a candidate with full scenario provenance", async () => {
    const publish = vi.fn().mockResolvedValue({ id: "candidate-a" });
    const result = await createHermesLearningCandidate(
      { publish },
      {
        organizationId: "org-a",
        scenarioId: "scenario-a",
        reportId: "report-a",
        runIds: ["run-a", "run-b"],
        evidenceRefs: ["evidence-a"],
        finding: "Segment A reacted more strongly in synthetic runs.",
        confidence: 0.72,
      },
    );

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0]?.[0]).toMatchObject({
      lifecycle: "CANDIDATE",
      source: "scenario_lab",
      scenarioId: "scenario-a",
      reportId: "report-a",
    });
    expect(result.id).toBe("candidate-a");
  });

  it("does not expose an ACTIVE lifecycle option", async () => {
    const publish = vi.fn().mockImplementation(async (candidate) => {
      expect(candidate.lifecycle).toBe("CANDIDATE");
      return { id: "candidate-a" };
    });

    await createHermesLearningCandidate(
      { publish },
      {
        organizationId: "org-a",
        scenarioId: "scenario-a",
        reportId: "report-a",
        runIds: [],
        evidenceRefs: [],
        finding: "A synthetic finding",
        confidence: null,
      },
    );
  });
});
