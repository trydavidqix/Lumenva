import type { PublicationMetricSnapshot } from "@/lib/content-os/distribution/metrics-service";

export interface ContentPerformanceDimensions {
  organizationId?: string;
  contentId: string;
  creatorId?: string;
  productId?: string;
  offerId?: string;
  campaignId?: string;
  variantId?: string;
}

export interface ContentPerformanceObservation {
  organizationId: string;
  publicationJobId: string;
  providerRef: string | null;
  capturedAt: string;
  contentId: string;
  creatorId?: string;
  productId?: string;
  offerId?: string;
  campaignId?: string;
  variantId?: string;
  metrics: PublicationMetricSnapshot["metrics"];
  financialOutcome: null;
  requiresRevenueEvidence: true;
  evidenceRefs: string[];
}

export function toContentPerformanceObservation(input: {
  snapshot: PublicationMetricSnapshot;
  dimensions: ContentPerformanceDimensions;
}): ContentPerformanceObservation {
  if (input.dimensions.organizationId && input.dimensions.organizationId !== input.snapshot.organization_id) {
    throw new Error("content_performance_tenant_mismatch");
  }
  return {
    organizationId: input.snapshot.organization_id,
    publicationJobId: input.snapshot.publication_job_id,
    providerRef: input.snapshot.provider_ref,
    capturedAt: input.snapshot.captured_at,
    contentId: input.dimensions.contentId,
    creatorId: input.dimensions.creatorId,
    productId: input.dimensions.productId,
    offerId: input.dimensions.offerId,
    campaignId: input.dimensions.campaignId,
    variantId: input.dimensions.variantId,
    metrics: { ...input.snapshot.metrics },
    financialOutcome: null,
    requiresRevenueEvidence: true,
    evidenceRefs: [
      `publication:${input.snapshot.publication_job_id}`,
      ...(input.snapshot.provider_ref ? [`provider_publication:${input.snapshot.provider_ref}`] : []),
      `metrics_captured_at:${input.snapshot.captured_at}`,
    ],
  };
}
