import { describe, expect, it } from "vitest";
import { evaluateCompletion, evaluateVerification, type CompletionPolicy, type VerificationPolicy } from "./verification";
describe("verification and completion policy", () => {
  const verification: VerificationPolicy = { rules: [{ envelope: "BUILD", verifyVia: "focused_tests" }, { envelope: "CHANGE", verifyVia: "diff_check" }] };
  const completion: CompletionPolicy = { conditions: [{ id: "tests", verifyVia: "focused_tests" }, { id: "evidence", verifyVia: "evidence_ref" }] };
  it("requires a verification rule for every mutating envelope", () => {
    expect(evaluateVerification(verification, ["BUILD", "CHANGE"])).toEqual({ ok: true });
    expect(evaluateVerification({ rules: [] }, ["EXECUTE"])).toEqual({ ok: false, code: "E_VERIFICATION_RULE_MISSING" });
  });
  it("does not complete without every deterministic condition", () => {
    expect(evaluateCompletion(completion, ["tests", "evidence"])).toEqual({ ok: true });
    expect(evaluateCompletion(completion, ["tests"])).toEqual({ ok: false, code: "E_COMPLETION_CONDITION_MISSING" });
  });
});