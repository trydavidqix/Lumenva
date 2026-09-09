import { describe, expect, it } from "vitest";

import { factCheckResearchPackage } from "./fact-check";
import { createResearchPackage } from "./research-package";

const base = {
  topic: "AI agents",
  angle: "What changed for operators",
  claims: [
    { id: "claim-1", text: "The vendor launched the feature", importance: "material" as const },
    { id: "claim-2", text: "The feature is available today", importance: "critical" as const },
    { id: "claim-3", text: "Operators may reduce manual work", importance: "contextual" as const },
  ],
};

describe("research package and fact-check", () => {
  it("normalizes package order and links before checking", () => {
    const pkg = createResearchPackage({
      ...base,
      sources: [
        { id: "source-b", url: "https://b.test", title: "B", publisher: "B", kind: "secondary", retrievedAt: "2026-09-07", supportsClaimIds: ["claim-1"] },
        { id: "source-a", url: "https://a.test", title: "A", publisher: "A", kind: "primary", retrievedAt: "2026-09-07", supportsClaimIds: ["claim-1"] },
      ],
    });
    expect(pkg.sources.map((source) => source.id)).toEqual(["source-a", "source-b"]);
    expect(factCheckResearchPackage(pkg).assessments[0]).toMatchObject({ status: "confirmed", evidenceIds: ["source-a", "source-b"] });
  });

  it("distinguishes attributed, inferred, unverified and conflicting claims", () => {
    const pkg = createResearchPackage({
      ...base,
      sources: [
        { id: "primary", url: "https://primary.test", title: "Primary", publisher: "Vendor", kind: "primary", retrievedAt: "2026-09-07", supportsClaimIds: ["claim-1"] },
        { id: "secondary", url: "https://secondary.test", title: "Secondary", publisher: "Press", kind: "secondary", retrievedAt: "2026-09-07", supportsClaimIds: ["claim-2"] },
        { id: "community", url: "https://community.test", title: "Community", publisher: "Community", kind: "community", retrievedAt: "2026-09-07", supportsClaimIds: ["claim-3"] },
        { id: "secondary-2", url: "https://secondary-2.test", title: "Secondary 2", publisher: "Press 2", kind: "secondary", retrievedAt: "2026-09-07", contradictsClaimIds: ["claim-2"] },
      ],
    });
    const result = factCheckResearchPackage(pkg);
    expect(result.assessments.map((assessment) => assessment.status)).toEqual(["attributed", "conflicting", "inferred"]);
    expect(result.passed).toBe(false);
    expect(result.blockingClaimIds).toEqual(["claim-2"]);
  });

  it("blocks critical claims without evidence and rejects unknown links", () => {
    const pkg = createResearchPackage({ ...base, sources: [] });
    expect(factCheckResearchPackage(pkg).blockingClaimIds).toEqual(["claim-1", "claim-2", "claim-3"]);
    expect(() => createResearchPackage({ ...base, sources: [{ id: "source", url: "https://source.test", title: "Source", publisher: "Publisher", kind: "primary", retrievedAt: "2026-09-07", supportsClaimIds: ["missing"] }] })).toThrow("unknown claim");
  });
});
