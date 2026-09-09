import type {
  Claim,
  ClaimAssessment,
  ClaimStatus,
  Evidence,
  FactCheckResult,
  ResearchPackage,
} from "./contracts";

function supports(claim: Claim, evidence: Evidence): boolean {
  return evidence.supportsClaimIds?.includes(claim.id) ?? false;
}

function contradicts(claim: Claim, evidence: Evidence): boolean {
  return evidence.contradictsClaimIds?.includes(claim.id) ?? false;
}

function assessClaim(claim: Claim, evidence: Evidence[]): ClaimAssessment {
  const supporting = evidence.filter((item) => supports(claim, item));
  const contradicting = evidence.filter((item) => contradicts(claim, item));
  const evidenceIds = supporting.map((item) => item.id).sort((a, b) => a.localeCompare(b));
  const primary = supporting.filter((item) => item.kind === "primary");
  const secondary = supporting.filter((item) => item.kind === "secondary");
  const community = supporting.filter((item) => item.kind === "community");

  let status: ClaimStatus;
  let reason: string;
  if (supporting.length === 0) {
    status = "unverified";
    reason = "No evidence is linked to the claim";
  } else if (contradicting.length > 0) {
    status = "conflicting";
    reason = "Evidence explicitly contradicts the claim";
  } else if (primary.length > 0 && supporting.some((item) => item.kind === "secondary")) {
    status = "confirmed";
    reason = "Primary evidence is corroborated by secondary evidence";
  } else if (primary.length > 0) {
    status = "attributed";
    reason = "The claim is supported by a primary source and must remain attributed to it";
  } else if (secondary.length > 0 || community.length > 0) {
    status = "inferred";
    reason = "The claim is supported indirectly and requires cautious wording";
  } else {
    status = "unverified";
    reason = "Linked evidence does not meet a supported evidence standard";
  }

  return {
    claimId: claim.id,
    status,
    evidenceIds,
    reason,
    publishable:
      (status !== "unverified" && status !== "conflicting" && claim.importance !== "critical") ||
      status === "confirmed",
  };
}

/** Runs fact-checking without network calls or model-dependent decisions. */
export function factCheckResearchPackage(pkg: ResearchPackage): FactCheckResult {
  const assessments = pkg.claims.map((claim) => assessClaim(claim, pkg.sources));
  const blockingClaimIds = assessments
    .filter((assessment) => !assessment.publishable)
    .map((assessment) => assessment.claimId);

  return {
    passed: blockingClaimIds.length === 0,
    assessments,
    blockingClaimIds,
  };
}
