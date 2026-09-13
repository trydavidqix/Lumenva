import { describe, expect, it } from "vitest";
import { attributeConversion } from "./attribution";

describe("revenue attribution", () => {
  it("prefers exact click/sub id evidence over UTM evidence", () => {
    const [result] = attributeConversion({
      organizationId: "org-a",
      conversionId: "sale-1",
      clickId: "click-1",
      subId: "sub-1",
      utm: { campaign: "launch" },
      candidates: [
        { id: "weak", organizationId: "org-a", utm: { campaign: "launch" }, evidenceRefs: ["utm"] },
        { id: "strong", organizationId: "org-a", clickId: "click-1", subId: "sub-1", evidenceRefs: ["click", "sub"] },
      ],
    });
    expect(result?.candidateId).toBe("strong");
    expect(result?.model).toBe("exact_identifier");
  });

  it("returns explicit unattributed instead of fabricating a match", () => {
    const [result] = attributeConversion({ organizationId: "org-a", conversionId: "sale-2", candidates: [] });
    expect(result).toMatchObject({ model: "unattributed", candidateId: null, confidence: 0 });
  });

  it("never considers another organization's candidate", () => {
    const [result] = attributeConversion({
      organizationId: "org-a",
      conversionId: "sale-3",
      clickId: "click-1",
      candidates: [{ id: "foreign", organizationId: "org-b", clickId: "click-1", evidenceRefs: ["x"] }],
    });
    expect(result?.candidateId).toBeNull();
  });
});
