export type VerificationEnvelope = "BUILD" | "CHANGE" | "EXECUTE";
export interface VerificationRule { envelope: VerificationEnvelope; verifyVia: string; }
export interface VerificationPolicy { rules: readonly VerificationRule[]; }
export interface CompletionCondition { id: string; verifyVia: string; }
export interface CompletionPolicy { conditions: readonly CompletionCondition[]; }
export type PolicyCheck = { ok: true } | { ok: false; code: "E_VERIFICATION_RULE_MISSING" | "E_COMPLETION_CONDITION_MISSING" };
export function evaluateVerification(policy: VerificationPolicy, envelopes: readonly VerificationEnvelope[]): PolicyCheck {
  for (const envelope of envelopes) if (!policy.rules.some((rule) => rule.envelope === envelope && rule.verifyVia.trim() !== "")) return { ok: false, code: "E_VERIFICATION_RULE_MISSING" };
  return { ok: true };
}
export function evaluateCompletion(policy: CompletionPolicy, verifiedIds: readonly string[]): PolicyCheck {
  const verified = new Set(verifiedIds);
  return policy.conditions.every((condition) => verified.has(condition.id) && condition.verifyVia.trim() !== "") ? { ok: true } : { ok: false, code: "E_COMPLETION_CONDITION_MISSING" };
}
