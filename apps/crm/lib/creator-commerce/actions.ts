import type { ToolRiskLevel } from "@/lib/agent-engine/contracts/agent-os";
import type { CommercialComplianceStatus } from "./compliance";

export const creatorCommerceActions = [
  "creator.upsert",
  "product.shortlist",
  "campaign.create",
  "experiment.create",
  "provider.sync.request",
  "revenue.reconcile.request",
  "publication.request_commercial",
  "publication.execute_external",
] as const;

export type CreatorCommerceAction = (typeof creatorCommerceActions)[number];

const RISK: Record<CreatorCommerceAction, ToolRiskLevel> = {
  "creator.upsert": "r1_reversible_write",
  "product.shortlist": "r1_reversible_write",
  "campaign.create": "r1_reversible_write",
  "experiment.create": "r1_reversible_write",
  "provider.sync.request": "r1_reversible_write",
  "revenue.reconcile.request": "r1_reversible_write",
  "publication.request_commercial": "r3_sensitive_commercial",
  "publication.execute_external": "r3_sensitive_commercial",
};

export function classifyCreatorCommerceAction(action: CreatorCommerceAction): ToolRiskLevel {
  return RISK[action];
}

export type CreatorCommerceActionDecision =
  | { kind: "allow" }
  | { kind: "deny"; reason: string }
  | { kind: "require_approval"; reason: string; approvalType: "commercial_action" };

export function decideCreatorCommerceAction(input: {
  action: CreatorCommerceAction;
  complianceStatus: CommercialComplianceStatus;
  capabilityAvailable: boolean;
}): CreatorCommerceActionDecision {
  if (input.complianceStatus === "BLOCK") return { kind: "deny", reason: "commerce_compliance_blocked" };
  if (input.complianceStatus === "REVIEW_REQUIRED") return { kind: "require_approval", reason: "commerce_compliance_review_required", approvalType: "commercial_action" };
  if (!input.capabilityAvailable) return { kind: "deny", reason: "commerce_capability_unavailable" };

  const risk = classifyCreatorCommerceAction(input.action);
  if (risk === "r3_sensitive_commercial" || risk === "r4_destructive_admin") {
    return { kind: "require_approval", reason: `risk_${risk}`, approvalType: "commercial_action" };
  }
  return { kind: "allow" };
}
