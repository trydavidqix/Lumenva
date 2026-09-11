export const MODULE_RISK_TIERS = ["P0", "P1", "P2", "P3", "P4"] as const;
export type ModuleRiskTier = (typeof MODULE_RISK_TIERS)[number];

export type AuthorizationDenyReason =
  | "tenant_rls_denied"
  | "module_not_entitled"
  | "dependency_missing"
  | "module_conflict"
  | "capability_missing"
  | "role_denied"
  | "risk_exceeds_policy"
  | "approval_required"
  | "approval_invalid"
  | "authorization_contract_invalid";

export interface ModuleContract {
  id: string;
  version: string;
  dependencies: string[];
  conflicts: string[];
  requiredCapabilities: string[];
  allowedRoles: string[];
  risk: ModuleRiskTier;
  requiresApproval: boolean;
}

export interface TenantAuthorizationContext {
  organizationId: string;
  rlsOrganizationId: string | null;
  rlsAllowed: boolean;
  plan: string;
  entitledModules: string[];
}

export interface ActorAuthorizationContext {
  actorId: string;
  organizationId: string;
  role: string;
  capabilities: string[];
}

export interface ApprovalContext {
  required: boolean;
  approved: boolean;
  approvalId?: string;
}

export interface AuthorizeModuleInput {
  requestId: string;
  policyVersion: string;
  module: ModuleContract;
  tenant: TenantAuthorizationContext;
  actor: ActorAuthorizationContext;
  enabledModules: string[];
  maxRisk: ModuleRiskTier;
  approval: ApprovalContext;
}

export interface AuthorizationCheck {
  stage: "tenant_rls" | "entitlement" | "dependencies_conflicts" | "capability_role" | "risk" | "approval";
  result: "PASS" | "FAIL";
  reason?: AuthorizationDenyReason;
}

export interface AuthorizationAudit {
  requestId: string;
  moduleId: string;
  moduleVersion: string;
  organizationId: string;
  plan: string;
  actorId: string;
  policyVersion: string;
  checks: AuthorizationCheck[];
}

export type AuthorizationDecision =
  | { decision: "ALLOW"; policyVersion: string; audit: AuthorizationAudit }
  | { decision: "DENY"; reason: AuthorizationDenyReason; policyVersion: string; audit: AuthorizationAudit };

const riskRank = (risk: ModuleRiskTier): number => MODULE_RISK_TIERS.indexOf(risk);

function auditFor(input: AuthorizeModuleInput, checks: AuthorizationCheck[]): AuthorizationAudit {
  return {
    requestId: input.requestId,
    moduleId: input.module.id,
    moduleVersion: input.module.version,
    organizationId: input.tenant.organizationId,
    plan: input.tenant.plan,
    actorId: input.actor.actorId,
    policyVersion: input.policyVersion,
    checks,
  };
}

function deny(input: AuthorizeModuleInput, reason: AuthorizationDenyReason, checks: AuthorizationCheck[]): AuthorizationDecision {
  return { decision: "DENY", reason, policyVersion: input.policyVersion, audit: auditFor(input, checks) };
}

function validContract(module: ModuleContract): boolean {
  return Boolean(
    module.id.trim() && module.version.trim() &&
      MODULE_RISK_TIERS.includes(module.risk) &&
      !module.dependencies.includes(module.id) &&
      !module.conflicts.includes(module.id),
  );
}

export function authorizeModule(input: AuthorizeModuleInput): AuthorizationDecision {
  const checks: AuthorizationCheck[] = [];
  if (!validContract(input.module)) return deny(input, "authorization_contract_invalid", checks);

  if (!input.tenant.rlsAllowed || input.tenant.rlsOrganizationId !== input.tenant.organizationId || input.actor.organizationId !== input.tenant.organizationId) {
    checks.push({ stage: "tenant_rls", result: "FAIL", reason: "tenant_rls_denied" });
    return deny(input, "tenant_rls_denied", checks);
  }
  checks.push({ stage: "tenant_rls", result: "PASS" });

  if (!input.tenant.entitledModules.includes(input.module.id)) {
    checks.push({ stage: "entitlement", result: "FAIL", reason: "module_not_entitled" });
    return deny(input, "module_not_entitled", checks);
  }
  checks.push({ stage: "entitlement", result: "PASS" });

  const missingDependency = input.module.dependencies.find((dependency) => !input.enabledModules.includes(dependency));
  const conflict = input.module.conflicts.find((candidate) => input.enabledModules.includes(candidate));
  if (missingDependency) {
    checks.push({ stage: "dependencies_conflicts", result: "FAIL", reason: "dependency_missing" });
    return deny(input, "dependency_missing", checks);
  }
  if (conflict) {
    checks.push({ stage: "dependencies_conflicts", result: "FAIL", reason: "module_conflict" });
    return deny(input, "module_conflict", checks);
  }
  checks.push({ stage: "dependencies_conflicts", result: "PASS" });

  const missingCapability = input.module.requiredCapabilities.find((capability) => !input.actor.capabilities.includes(capability));
  if (missingCapability) {
    checks.push({ stage: "capability_role", result: "FAIL", reason: "capability_missing" });
    return deny(input, "capability_missing", checks);
  }
  if (!input.module.allowedRoles.includes(input.actor.role)) {
    checks.push({ stage: "capability_role", result: "FAIL", reason: "role_denied" });
    return deny(input, "role_denied", checks);
  }
  checks.push({ stage: "capability_role", result: "PASS" });

  if (riskRank(input.module.risk) > riskRank(input.maxRisk)) {
    checks.push({ stage: "risk", result: "FAIL", reason: "risk_exceeds_policy" });
    return deny(input, "risk_exceeds_policy", checks);
  }
  checks.push({ stage: "risk", result: "PASS" });

  if (input.module.requiresApproval || input.approval.required) {
    if (!input.approval.approved) {
      checks.push({ stage: "approval", result: "FAIL", reason: input.approval.required ? "approval_required" : "approval_invalid" });
      return deny(input, input.approval.required ? "approval_required" : "approval_invalid", checks);
    }
  }
  checks.push({ stage: "approval", result: "PASS" });
  return { decision: "ALLOW", policyVersion: input.policyVersion, audit: auditFor(input, checks) };
}
