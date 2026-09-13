import type { CapabilityStatus } from "./country-capabilities";

export const commercialComplianceStatuses = ["PASS", "REVIEW_REQUIRED", "BLOCK"] as const;
export type CommercialComplianceStatus = (typeof commercialComplianceStatuses)[number];

export type CommercialComplianceInput = {
  editorial: {
    passed: boolean;
    evidenceRefs?: readonly string[];
  };
  capability: {
    status: CapabilityStatus;
    evidenceRefs?: readonly string[];
  };
  prohibitedClaims: readonly string[];
  commercialDisclosurePresent: boolean;
  aiDisclosureRequired: boolean;
  aiDisclosurePresent: boolean;
  identityLikenessAuthorized: boolean;
  evidenceRefs?: readonly string[];
  /** Informational only. Models cannot override deterministic policy. */
  modelRecommendation?: CommercialComplianceStatus | string | null;
};

export type CommercialComplianceDecision = Readonly<{
  status: CommercialComplianceStatus;
  ruleIds: readonly string[];
  reasons: readonly string[];
  evidenceRefs: readonly string[];
}>;

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function allEvidence(input: CommercialComplianceInput): string[] {
  return unique([
    ...(input.editorial.evidenceRefs ?? []),
    ...(input.capability.evidenceRefs ?? []),
    ...(input.evidenceRefs ?? []),
  ]);
}

/**
 * Deterministic commercial publication policy.
 *
 * This function deliberately ignores modelRecommendation when deciding the
 * result. Models may explain policy, but they cannot weaken a deterministic
 * block or upgrade review-required evidence to PASS.
 */
export function evaluateCommercialCompliance(
  input: CommercialComplianceInput,
): CommercialComplianceDecision {
  const blockingRules: Array<{ rule: string; reason: string }> = [];
  const reviewRules: Array<{ rule: string; reason: string }> = [];

  if (!input.editorial.passed) {
    blockingRules.push({
      rule: "commerce_compliance.editorial_quality_failed",
      reason: "Editorial quality gate did not pass.",
    });
  }
  if (input.prohibitedClaims.length > 0) {
    blockingRules.push({
      rule: "commerce_compliance.prohibited_claim",
      reason: "Content contains a prohibited or unsupported commercial claim.",
    });
  }
  if (!input.commercialDisclosurePresent) {
    blockingRules.push({
      rule: "commerce_compliance.commercial_disclosure_missing",
      reason: "Required commercial or affiliate disclosure is missing.",
    });
  }
  if (input.aiDisclosureRequired && !input.aiDisclosurePresent) {
    blockingRules.push({
      rule: "commerce_compliance.ai_disclosure_missing",
      reason: "Required AI-generated-content disclosure is missing.",
    });
  }
  if (!input.identityLikenessAuthorized) {
    blockingRules.push({
      rule: "commerce_compliance.identity_likeness_restricted",
      reason: "Identity or likeness rights are not authorized.",
    });
  }
  if (input.capability.status === "DENY") {
    blockingRules.push({
      rule: "commerce_compliance.country_capability_denied",
      reason: "The provider capability is denied for this market.",
    });
  } else if (input.capability.status === "UNKNOWN") {
    reviewRules.push({
      rule: "commerce_compliance.country_capability_unknown",
      reason: "The provider capability is not proven for this market.",
    });
  } else if (input.capability.status === "REVIEW_REQUIRED") {
    reviewRules.push({
      rule: "commerce_compliance.country_capability_review_required",
      reason: "The provider capability requires human review for this market.",
    });
  }

  const evidenceRefs = allEvidence(input);
  if (blockingRules.length > 0) {
    return Object.freeze({
      status: "BLOCK",
      ruleIds: blockingRules.map((item) => item.rule),
      reasons: blockingRules.map((item) => item.reason),
      evidenceRefs,
    });
  }
  if (reviewRules.length > 0) {
    return Object.freeze({
      status: "REVIEW_REQUIRED",
      ruleIds: reviewRules.map((item) => item.rule),
      reasons: reviewRules.map((item) => item.reason),
      evidenceRefs,
    });
  }

  return Object.freeze({
    status: "PASS",
    ruleIds: ["commerce_compliance.passed"],
    reasons: ["All deterministic commercial publication gates passed."],
    evidenceRefs,
  });
}
