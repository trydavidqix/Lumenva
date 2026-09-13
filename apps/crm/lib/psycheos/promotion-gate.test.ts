import { describe, expect, it } from "vitest";
import { evaluatePromotionGate } from "./promotion-gate";

describe("Wave 14 promotion gate", () => {
  const pass = (caseId: string) => ({ caseId, status: "PASS" as const, evidenceRef: `sha256:${caseId}` });

  it("allows only when every evaluated case has evidence and passes", () => {
    expect(evaluatePromotionGate([pass("boundary"), pass("truthfulness")])).toEqual({ status: "ALLOW", reason: "ALL_EVALS_PASS", failedCases: [] });
  });

  it("denies promotion when one case fails, even if all others pass", () => {
    expect(evaluatePromotionGate([pass("boundary"), { caseId: "red-team", status: "FAIL", evidenceRef: "sha256:red-team" }, pass("decay")])).toEqual({ status: "DENY", reason: "EVAL_FAILURE", failedCases: ["red-team"] });
  });

  it("denies empty or evidence-less results fail-closed", () => {
    expect(evaluatePromotionGate([]).status).toBe("DENY");
    expect(evaluatePromotionGate([{ caseId: "missing", status: "PASS", evidenceRef: "" }])).toEqual({ status: "DENY", reason: "MISSING_EVIDENCE", failedCases: ["missing"] });
  });
});
