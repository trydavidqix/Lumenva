export const MODULE_RISK_TIERS = ["P0", "P1", "P2", "P3", "P4"] as const;
export type ModuleRiskTier = (typeof MODULE_RISK_TIERS)[number];

export type AuthorizationDecision =
  | {
      readonly kind: "ALLOW";
      readonly policyVersion: string;
      readonly audit: AuthorizationAudit;
    }
  | {
      readonly kind: "DENY";
      readonly reason: AuthorizationDenyReason;
      readonly policyVersion: string;
      readonly audit: AuthorizationAudit;
    };

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
  readonly id: string;
  readonly version: string;
  readonly dependencies: readonly string[];
  readonly conflicts: readonly string[];
  readonly requiredCapabilities: readonly string[];
  readonly allowedRoles: readonly string[];
  readonly risk: ModuleRiskTier;
  readonly requiresApproval: boolean;
}

export interface TenantAuthorizationContext {
  readonly organizationId: string;
  readonly rlsOrganizationId: string;
  readonly rlsAllowed: boolean;
  readonly plan: string;
  readonly entitledModules: readonly string[];
}

export interface ActorAuthorizationContext {
  readonly actorId: string;
  readonly organizationId: string;
  readonly role: string;
  readonly capabilities: readonly string[];
}

export interface ApprovalContext {
  readonly required: boolean;
  readonly approved: boolean;
  readonly approvalId?: string;
}

export interface AuthorizeModuleInput {
  readonly requestId: string;
  readonly policyVersion: string;
  readonly module: ModuleContract;
  readonly tenant: TenantAuthorizationContext;
  readonly actor: ActorAuthorizationContext;
  readonly enabledModules: readonly string[];
  readonly maxRisk: ModuleRiskTier;
  readonly approval: ApprovalContext;
}

export interface AuthorizationAudit {
  readonly requestId: string;
  readonly moduleId: string;
  readonly moduleVersion: string;
  readonly organizationId: string;
  readonly plan: string;
  readonly actorId: string;
  readonly policyVersion: string;
  readonly checks: readonly AuthorizationCheck[];
}

export interface AuthorizationCheck {
  readonly stage: AuthorizationStage;
  readonly result: "PASS" | "FAIL";
  readonly reason?: AuthorizationDenyReason;
}

export type AuthorizationStage =
  | "tenant_rls"
  | "entitlement"
  | "dependencies_conflicts"
  | "capability_role"
  | "risk"
  | "approval";

const RISK_RANK: Readonly<Record<ModuleRiskTier, number>> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
};

function invalidContract(input: AuthorizeModuleInput): boolean {
  return Boolean(
    !input.requestId.trim() ||
      !input.policyVersion.trim() ||
      !input.module.id.trim() ||
      !input.module.version.trim() ||
      !input.tenant.organizationId.trim() ||
      !input.tenant.rlsOrganizationId.trim() ||
      !input.tenant.plan.trim() ||
      !input.actor.actorId.trim() ||
      !input.actor.organizationId.trim() ||
      !input.actor.role.trim(),
  );
}

function auditFor(input: AuthorizeModuleInput, checks: readonly AuthorizationCheck[]): AuthorizationAudit {
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

export function authorizeModule(input: AuthorizeModuleInput): AuthorizationDecision {
  const checks: AuthorizationCheck[] = [];
  const deny = (stage: AuthorizationStage, reason: AuthorizationDenyReason): AuthorizationDecision => ({
    kind: "DENY",
    reason,
    policyVersion: input.policyVersion,
    audit: auditFor(input, [...checks, { stage, result: "FAIL", reason }]),
  });

  if (invalidContract(input)) return deny("tenant_rls", "authorization_contract_invalid");

  const tenantPass = input.tenant.rlsAllowed &&
    input.tenant.organizationId === input.tenant.rlsOrganizationId &&
    input.actor.organizationId === input.tenant.organizationId;
  if (!tenantPass) return deny("tenant_rls", "tenant_rls_denied");
  checks.push({ stage: "tenant_rls", result: "PASS" });

  if (!input.tenant.entitledModules.includes(input.module.id)) return deny("entitlement", "module_not_entitled");
  checks.push({ stage: "entitlement", result: "PASS" });

  const enabled = new Set(input.enabledModules);
  const missingDependency = input.module.dependencies.find((dependency) => !enabled.has(dependency));
  if (missingDependency !== undefined) return deny("dependencies_conflicts", "dependency_missing");
  if (input.module.conflicts.some((conflict) => enabled.has(conflict))) return deny("dependencies_conflicts", "module_conflict");
  checks.push({ stage: "dependencies_conflicts", result: "PASS" });

  const capabilities = new Set(input.actor.capabilities);
  if (input.module.requiredCapabilities.some((capability) => !capabilities.has(capability))) return deny("capability_role", "capability_missing");
  if (!input.module.allowedRoles.includes(input.actor.role)) return deny("capability_role", "role_denied");
  checks.push({ stage: "capability_role", result: "PASS" });

  if (RISK_RANK[input.module.risk] > RISK_RANK[input.maxRisk]) return deny("risk", "risk_exceeds_policy");
  checks.push({ stage: "risk", result: "PASS" });

  const approvalRequired = input.module.requiresApproval || input.approval.required;
  if (approvalRequired && !input.approval.approved) return deny("approval", "approval_required");
  if (approvalRequired && !input.approval.approvalId?.trim()) return deny("approval", "approval_invalid");
  checks.push({ stage: "approval", result: "PASS" });

  return { kind: "ALLOW", policyVersion: input.policyVersion, audit: auditFor(input, checks) };
}
