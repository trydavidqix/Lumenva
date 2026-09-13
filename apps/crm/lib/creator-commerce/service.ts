export interface CreatorCommerceCapabilityQuery {
  organizationId: string;
  country: string;
  provider: string;
  capability: string;
}

export interface CreatorCommerceServiceDependencies {
  getCapability(input: CreatorCommerceCapabilityQuery): Promise<{ organizationId: string; available: boolean; reasons: string[]; evidenceRefs: string[] }>;
  requestPublication(input: { organizationId: string; contentId: string }): Promise<{ publicationId: string; evidenceRefs: string[] }>;
  getPerformance(input: { organizationId: string; publicationId: string }): Promise<{ views: number; clicks: number; evidenceRefs: string[] }>;
  getRevenue(input: { organizationId: string; publicationId: string }): Promise<{ netRevenueMinor: number; evidenceRefs: string[] }>;
  evaluateExperiment(input: { organizationId: string; publicationId: string; netRevenueMinor: number; views: number; clicks: number }): Promise<{ status: string; winnerArmId: string | null; evidence: string[] }>;
}

export interface CreatorCommerceEvidenceFlowInput {
  organizationId: string;
  contentId: string;
  country: string;
  provider: string;
  capability: string;
}

export function createCreatorCommerceService(deps: CreatorCommerceServiceDependencies) {
  return {
    async runEvidenceFlow(input: CreatorCommerceEvidenceFlowInput) {
      const capability = await deps.getCapability({
        organizationId: input.organizationId,
        country: input.country,
        provider: input.provider,
        capability: input.capability,
      });
      if (capability.organizationId !== input.organizationId) throw new Error("creator_commerce_tenant_mismatch");
      if (!capability.available) throw new Error("creator_commerce_capability_blocked");

      const publication = await deps.requestPublication({ organizationId: input.organizationId, contentId: input.contentId });
      const performance = await deps.getPerformance({ organizationId: input.organizationId, publicationId: publication.publicationId });
      const revenue = await deps.getRevenue({ organizationId: input.organizationId, publicationId: publication.publicationId });
      const experiment = await deps.evaluateExperiment({
        organizationId: input.organizationId,
        publicationId: publication.publicationId,
        netRevenueMinor: revenue.netRevenueMinor,
        views: performance.views,
        clicks: performance.clicks,
      });

      return {
        organizationId: input.organizationId,
        publicationId: publication.publicationId,
        performance,
        revenue,
        experiment,
        evidenceRefs: [...new Set([
          ...capability.evidenceRefs,
          ...publication.evidenceRefs,
          ...performance.evidenceRefs,
          ...revenue.evidenceRefs,
          ...experiment.evidence,
        ])],
      };
    },
  };
}
