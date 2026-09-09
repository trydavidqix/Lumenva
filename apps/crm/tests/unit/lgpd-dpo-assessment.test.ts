import { describe, expect, it } from "vitest";
import { readDpoAssessment, DPO_ASSESSMENT_V1 } from "@/lib/lgpd/dpo-assessment";

describe("RGPD J2 DPO assessment", () => {
  it("defaults the rollout flag to OFF", () => expect(DPO_ASSESSMENT_V1).toBe(false));
  it("keeps an unassessed tenant undefined", () => expect(readDpoAssessment({ dpo_required: null })).toBe("unknown"));
  it("represents the three assessment outcomes without inference", () => {
    expect(readDpoAssessment({ dpo_required: false })).toBe("not_required");
    expect(readDpoAssessment({ dpo_required: true })).toBe("required");
  });
});
