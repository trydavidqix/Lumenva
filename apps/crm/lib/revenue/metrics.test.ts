import { describe, expect, it } from "vitest";
import { calculateRevenueMetrics } from "./metrics";

describe("revenue KPI engine", () => {
  it("keeps all money in integer minor units", () => {
    const metrics = calculateRevenueMetrics({
      organizationId: "org-a",
      sales: [1000, 2500],
      refunds: [500],
      chargebacks: [250],
      commissionsPending: [100],
      commissionsApproved: [80],
      commissionsPaid: [50],
      views: 1000,
      clicks: 100,
      conversions: 10,
      videos: 2,
    });
    expect(metrics.gmvMinor).toBe(3500);
    expect(metrics.netRevenueMinor).toBe(2750);
    expect(metrics.revenuePerThousandViewsMinor).toBe(2750);
    expect(metrics.revenuePerVideoMinor).toBe(1375);
  });

  it("returns null for undefined ratios instead of fake zero", () => {
    const metrics = calculateRevenueMetrics({
      organizationId: "org-a", sales: [], refunds: [], chargebacks: [], commissionsPending: [], commissionsApproved: [], commissionsPaid: [], views: 0, clicks: 0, conversions: 0, videos: 0,
    });
    expect(metrics.ctr).toBeNull();
    expect(metrics.conversionRate).toBeNull();
    expect(metrics.epcMinor).toBeNull();
    expect(metrics.revenuePerVideoMinor).toBeNull();
  });

  it("rejects mixed-tenant grouped inputs", () => {
    expect(() => calculateRevenueMetrics({
      organizationId: "org-a", sourceOrganizationIds: ["org-a", "org-b"], sales: [], refunds: [], chargebacks: [], commissionsPending: [], commissionsApproved: [], commissionsPaid: [], views: 1, clicks: 1, conversions: 1, videos: 1,
    })).toThrow("revenue_metrics_tenant_mismatch");
  });
});
