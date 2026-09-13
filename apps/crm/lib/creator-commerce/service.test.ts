import { describe, expect, it, vi } from "vitest";
import { createCreatorCommerceService } from "./service";

describe("Creator Commerce orchestration facade", () => {
  it("preserves tenant identity across content -> revenue -> experiment flow", async () => {
    const calls: string[] = [];
    const service = createCreatorCommerceService({
      getCapability: async (input) => ({ organizationId: input.organizationId, available: true, reasons: [], evidenceRefs: ["cap"] }),
      requestPublication: async (input) => { calls.push(`publish:${input.organizationId}`); return { publicationId: "pub-1", evidenceRefs: ["pub"] }; },
      getPerformance: async (input) => { calls.push(`metrics:${input.organizationId}`); return { views: 1000, clicks: 100, evidenceRefs: ["metrics"] }; },
      getRevenue: async (input) => { calls.push(`revenue:${input.organizationId}`); return { netRevenueMinor: 5000, evidenceRefs: ["sale"] }; },
      evaluateExperiment: async (input) => { calls.push(`experiment:${input.organizationId}`); return { status: "winner", winnerArmId: "a", evidence: ["winner:a"] }; },
    });
    const result = await service.runEvidenceFlow({ organizationId: "org-a", contentId: "content-1", country: "PT", provider: "nuvemshop", capability: "getSales" });
    expect(calls).toEqual(["publish:org-a", "metrics:org-a", "revenue:org-a", "experiment:org-a"]);
    expect(result.organizationId).toBe("org-a");
    expect(result.evidenceRefs).toEqual(expect.arrayContaining(["cap", "pub", "metrics", "sale", "winner:a"]));
  });

  it("stops before publication when capability is denied", async () => {
    const publish = vi.fn();
    const service = createCreatorCommerceService({
      getCapability: async (input) => ({ organizationId: input.organizationId, available: false, reasons: ["country_DENY"], evidenceRefs: ["deny"] }),
      requestPublication: publish,
      getPerformance: vi.fn(),
      getRevenue: vi.fn(),
      evaluateExperiment: vi.fn(),
    });
    await expect(service.runEvidenceFlow({ organizationId: "org-a", contentId: "c", country: "CH", provider: "x", capability: "publish" })).rejects.toThrow("creator_commerce_capability_blocked");
    expect(publish).not.toHaveBeenCalled();
  });
});
