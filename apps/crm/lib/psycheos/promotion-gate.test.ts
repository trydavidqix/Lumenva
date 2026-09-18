import { describe, expect, it } from "vitest";

import { evaluatePromotionGate } from "./promotion-gate";

describe("fail-closed promotion gate", () => {
  it("denies an empty evaluation set or missing evidence", () => {
    expect(evaluatePromotionGate([])).toMatchObject({ status: "DENY", reason: "MISSING_EVIDENCE" });
    expect(evaluatePromotionGate([{ caseId: "case-a", status: "PASS", evidenceRef: "" }])).toMatchObject({ status: "DENY", reason: "MISSING_EVIDENCE", failedCases: ["case-a"] });
  });

  it("allows only when every case passes with evidence", () => {
    expect(evaluatePromotionGate([
      { caseId: "case-a", status: "PASS", evidenceRef: "sha256:a" },
      { caseId: "case-b", status: "PASS", evidenceRef: "sha256:b" },
    ])).toEqual({ status: "ALLOW", reason: "ALL_EVALS_PASS", failedCases: [] });
    expect(evaluatePromotionGate([{ caseId: "case-b", status: "FAIL", evidenceRef: "sha256:b" }])).toEqual({ status: "DENY", reason: "EVAL_FAILURE", failedCases: ["case-b"] });
  });
});
