import { describe, expect, it } from "vitest";
import { evaluateExperiment } from "./experiments";

describe("Creator Commerce experiments", () => {
  it("is inconclusive before minimum evidence and time window", () => {
    const result = evaluateExperiment({
      organizationId: "org-a",
      primaryMetric: "net_revenue_minor",
      minimumSampleSize: 20,
      minimumWindowMs: 86_400_000,
      startedAt: "2026-09-13T00:00:00Z",
      now: "2026-09-13T01:00:00Z",
      arms: [{ id: "a", organizationId: "org-a", samples: 100, metricTotal: 10000, safetyPassed: true }],
    });
    expect(result.status).toBe("inconclusive");
  });

  it("can use revenue as objective without bypassing safety", () => {
    const result = evaluateExperiment({
      organizationId: "org-a",
      primaryMetric: "net_revenue_minor",
      minimumSampleSize: 10,
      minimumWindowMs: 1000,
      startedAt: "2026-09-13T00:00:00Z",
      now: "2026-09-13T02:00:00Z",
      arms: [
        { id: "unsafe", organizationId: "org-a", samples: 20, metricTotal: 50000, safetyPassed: false },
        { id: "safe", organizationId: "org-a", samples: 20, metricTotal: 20000, safetyPassed: true },
      ],
    });
    expect(result.winnerArmId).toBe("safe");
    expect(result.evidence).toContain("unsafe:safety_blocked");
  });

  it("rejects cross-organization arms", () => {
    expect(() => evaluateExperiment({
      organizationId: "org-a", primaryMetric: "ctr", minimumSampleSize: 1, minimumWindowMs: 1,
      startedAt: "2026-09-13T00:00:00Z", now: "2026-09-13T02:00:00Z",
      arms: [{ id: "foreign", organizationId: "org-b", samples: 10, metricTotal: 1, safetyPassed: true }],
    })).toThrow("experiment_tenant_mismatch");
  });
});
