import type { AuthorizationDecision } from "./authorize-module";

/** View-only projection for settings/admin surfaces; it never authorizes work. */
export function toEntitlementReceiptView(decision: AuthorizationDecision) {
  return {
    status: decision.decision === "ALLOW" ? "allowed" as const : "denied" as const,
    reason: decision.decision === "DENY" ? decision.reason : null,
    requestId: decision.audit.requestId,
    moduleId: decision.audit.moduleId,
    policyVersion: decision.policyVersion,
    checks: decision.audit.checks,
  };
}
