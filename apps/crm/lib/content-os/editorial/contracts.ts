import { z } from "zod";

/** Evidence and claim contracts used between research, fact-check and writer stages. */
export type EvidenceKind = "primary" | "secondary" | "community";

export type Evidence = {
  id: string;
  url: string;
  title: string;
  publisher: string;
  kind: EvidenceKind;
  excerpt?: string;
  publishedAt?: string;
  retrievedAt: string;
  supportsClaimIds?: string[];
  contradictsClaimIds?: string[];
};

export type ClaimStatus =
  | "confirmed"
  | "attributed"
  | "inferred"
  | "unverified"
  | "conflicting";

export type Claim = {
  id: string;
  text: string;
  importance: "critical" | "material" | "contextual";
  /** Optional explicit status from an upstream extractor is never trusted as proof. */
  status?: ClaimStatus;
};

export type ClaimAssessment = {
  claimId: string;
  status: ClaimStatus;
  evidenceIds: string[];
  reason: string;
  publishable: boolean;
};

export type ResearchPackage = {
  topic: string;
  angle: string;
  sources: Evidence[];
  claims: Claim[];
};

export type FactCheckResult = {
  passed: boolean;
  assessments: ClaimAssessment[];
  blockingClaimIds: string[];
};

// Runtime boundaries for V1 persistence/API payloads. The lightweight types above
// remain the provider-neutral package contract used by the fact-checker.
const isoDateTime = z.iso.datetime({ offset: true });
const entityId = z.uuid();
const safeUrl = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "https:" || protocol === "http:";
}, "URL must use http or https");

export const researchRunStatuses = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export const researchRunSchema = z.object({
  id: entityId, organizationId: entityId, opportunityId: entityId.nullish(), requestedBy: entityId.nullish(),
  query: z.string().trim().min(1).max(500), status: z.enum(researchRunStatuses), startedAt: isoDateTime.nullish(),
  completedAt: isoDateTime.nullish(), errorCode: z.string().trim().min(1).max(100).nullish(),
  metadata: z.record(z.string(), z.unknown()).default({}), createdAt: isoDateTime, updatedAt: isoDateTime,
}).strict().superRefine((value, context) => {
  if (value.status === "running" && !value.startedAt) context.addIssue({ code: "custom", path: ["startedAt"], message: "Running research requires startedAt" });
  if (["succeeded", "failed", "cancelled"].includes(value.status) && !value.completedAt) context.addIssue({ code: "custom", path: ["completedAt"], message: "Terminal research requires completedAt" });
  if (value.status !== "failed" && value.errorCode) context.addIssue({ code: "custom", path: ["errorCode"], message: "Only failed research may have errorCode" });
});
export type ResearchRun = z.infer<typeof researchRunSchema>;

export const evidenceKinds = ["official", "primary", "independent", "secondary"] as const;
export const evidenceVerificationStatuses = ["unverified", "confirmed", "attributed", "conflicting"] as const;
export const evidenceSchema = z.object({
  id: entityId, organizationId: entityId, researchRunId: entityId, sourceUrl: safeUrl,
  sourceTitle: z.string().trim().min(1).max(500), publisher: z.string().trim().min(1).max(200).nullish(),
  kind: z.enum(evidenceKinds), verificationStatus: z.enum(evidenceVerificationStatuses), publishedAt: isoDateTime.nullish(),
  observedAt: isoDateTime, excerpt: z.string().trim().max(2_000).nullish(), contentHash: z.string().regex(/^[a-f0-9]{64}$/i).nullish(),
  metadata: z.record(z.string(), z.unknown()).default({}), createdAt: isoDateTime,
}).strict();
export type EditorialEvidence = z.infer<typeof evidenceSchema>;

export const claimImportance = ["critical", "major", "minor"] as const;
export const claimStatuses = ["pending", "confirmed", "attributed", "disputed", "rejected"] as const;
export const claimSchema = z.object({
  id: entityId, organizationId: entityId, researchRunId: entityId, statement: z.string().trim().min(1).max(2_000),
  importance: z.enum(claimImportance), status: z.enum(claimStatuses), confidence: z.number().min(0).max(1).nullish(),
  factCheckerNote: z.string().trim().max(2_000).nullish(), createdAt: isoDateTime, updatedAt: isoDateTime,
}).strict().superRefine((value, context) => {
  if (value.status !== "pending" && value.confidence === undefined) context.addIssue({ code: "custom", path: ["confidence"], message: "Reviewed claim requires confidence" });
  if (value.status === "rejected" && !value.factCheckerNote) context.addIssue({ code: "custom", path: ["factCheckerNote"], message: "Rejected claim requires factCheckerNote" });
});
export type EditorialClaim = z.infer<typeof claimSchema>;

export const claimEvidenceRelations = ["supports", "contradicts", "qualifies"] as const;
export const claimEvidenceSchema = z.object({
  id: entityId, organizationId: entityId, claimId: entityId, evidenceId: entityId,
  relation: z.enum(claimEvidenceRelations), note: z.string().trim().max(1_000).nullish(), createdAt: isoDateTime,
}).strict();
export type ClaimEvidenceLink = z.infer<typeof claimEvidenceSchema>;

export const qualityGateStatuses = ["passed", "failed", "blocked", "skipped"] as const;
export const qualityGateNames = ["source_policy", "claims_evidenced", "fact_check", "editorial_quality", "seo", "sensitive_topic"] as const;
export const qualityGateSchema = z.object({
  id: entityId, organizationId: entityId, contentId: entityId, name: z.enum(qualityGateNames), status: z.enum(qualityGateStatuses),
  score: z.number().int().min(0).max(100).nullish(), rationale: z.string().trim().min(1).max(2_000), checkedAt: isoDateTime,
  checkedBy: z.string().trim().min(1).max(100), metadata: z.record(z.string(), z.unknown()).default({}),
}).strict().superRefine((value, context) => {
  if (value.status === "passed" && value.score === undefined) context.addIssue({ code: "custom", path: ["score"], message: "Passed gate requires score" });
});
export type QualityGate = z.infer<typeof qualityGateSchema>;

export const editorialDecisions = ["publish", "manual_review", "research_again", "reject"] as const;
export const editorialQualityDecisionSchema = z.object({
  organizationId: entityId, contentId: entityId, decision: z.enum(editorialDecisions), score: z.number().int().min(0).max(100),
  gateIds: z.array(entityId), decidedAt: isoDateTime,
}).strict().superRefine((value, context) => {
  if (value.decision === "publish" && value.score < 90) context.addIssue({ code: "custom", path: ["score"], message: "Automatic publication requires score >= 90" });
});
export type EditorialQualityDecision = z.infer<typeof editorialQualityDecisionSchema>;
