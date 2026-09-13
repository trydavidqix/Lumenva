import { describe, expect, it } from "vitest";
import { toContentPerformanceObservation } from "./content-attribution-bridge";

describe("content metrics -> revenue attribution bridge", () => {
  it("preserves engagement metrics and explicit commerce dimensions", () => {
    const observation = toContentPerformanceObservation({
      snapshot: {
        organization_id: "org-a",
        publication_job_id: "pub-1",
        provider_ref: "remote-1",
        captured_at: "2026-09-13T10:00:00Z",
        metrics: { impressions: 1000, clicks: 55, likes: 20 },
        source_version: "v1",
      },
      dimensions: { contentId: "content-1", creatorId: "creator-1", productId: "product-1", campaignId: "campaign-1" },
    });
    expect(observation).toMatchObject({ organizationId: "org-a", publicationJobId: "pub-1", contentId: "content-1", metrics: { impressions: 1000, clicks: 55, likes: 20 } });
  });

  it("never fabricates a sale or financial result from engagement metrics", () => {
    const observation = toContentPerformanceObservation({
      snapshot: { organization_id: "org-a", publication_job_id: "pub-1", provider_ref: "remote-1", captured_at: "2026-09-13T10:00:00Z", metrics: { clicks: 1000 }, source_version: null },
      dimensions: { contentId: "content-1" },
    });
    expect(observation.financialOutcome).toBeNull();
    expect(observation.requiresRevenueEvidence).toBe(true);
  });

  it("fails closed on tenant-mismatched dimensions", () => {
    expect(() => toContentPerformanceObservation({
      snapshot: { organization_id: "org-a", publication_job_id: "pub-1", provider_ref: null, captured_at: "2026-09-13T10:00:00Z", metrics: {}, source_version: null },
      dimensions: { contentId: "content-1", organizationId: "org-b" },
    })).toThrow("content_performance_tenant_mismatch");
  });
});
