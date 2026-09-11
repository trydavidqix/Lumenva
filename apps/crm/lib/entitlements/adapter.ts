import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeModule, denyAuthorizationContract, type AuthorizeModuleInput, type ApprovalContext, type AuthorizationDecision, type ModuleContract, type ModuleRiskTier } from "./authorize-module";

const risk = z.enum(["P0", "P1", "P2", "P3", "P4"]);
const moduleSchema = z.object({
  id: z.string().min(1).max(120), version: z.string().min(1).max(40),
  dependencies: z.array(z.string()).default([]), conflicts: z.array(z.string()).default([]),
  requiredCapabilities: z.array(z.string()).default([]), allowedRoles: z.array(z.string()).default([]),
  risk, requiresApproval: z.boolean().default(false),
});
export const entitlementRequestSchema = z.object({
  module: moduleSchema, enabled_modules: z.array(z.string()).default([]), max_risk: risk.default("P4"),
  approval: z.object({ required: z.boolean().default(false), approved: z.boolean().default(false), approval_id: z.string().optional() }).default({ required: false, approved: false }),
});
export type EntitlementRequest = z.infer<typeof entitlementRequestSchema>;

export function buildEntitlementInput(input: {
  requestId: string; policyVersion: string; module: ModuleContract; organizationId: string; plan: string;
  entitledModules: string[]; actorId: string; role: string; capabilities?: string[]; enabledModules: string[]; maxRisk: ModuleRiskTier; approval: ApprovalContext;
}): AuthorizeModuleInput {
  return {
    requestId: input.requestId, policyVersion: input.policyVersion, module: input.module,
    tenant: { organizationId: input.organizationId, rlsOrganizationId: input.organizationId, rlsAllowed: true, plan: input.plan, entitledModules: input.entitledModules },
    actor: { actorId: input.actorId, organizationId: input.organizationId, role: input.role, capabilities: input.capabilities ?? [] },
    enabledModules: input.enabledModules, maxRisk: input.maxRisk, approval: input.approval,
  };
}

export async function readOrganizationEntitlements(supabase: SupabaseClient, organizationId: string): Promise<{ plan: string; entitledModules: string[] }> {
  // The catalog is server-side: client/module input never selects a plan or entitlement.
  type AssignmentQuery = { select: (columns: string) => AssignmentQuery; eq: (column: string, value: string) => AssignmentQuery; maybeSingle: () => Promise<{ data: { plan_id: string; plans?: { slug?: unknown } } | null; error: { message: string } | null }> };
  type ModuleQuery = { select: (columns: string) => ModuleQuery; eq: (column: string, value: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
  const db = supabase as unknown as { from: (table: string) => AssignmentQuery | ModuleQuery };
  const assignment = await (db.from("organization_plan") as AssignmentQuery).select("plan_id, plans!inner(slug)").eq("organization_id", organizationId).eq("status", "active").maybeSingle();
  if (assignment.error) throw new Error(assignment.error.message);
  const modules = assignment.data
    ? await (db.from("plan_modules") as ModuleQuery).select("modules!inner(slug)").eq("plan_id", assignment.data.plan_id)
    : { data: [], error: null };
  if (modules.error) throw new Error(modules.error.message);
  return {
    plan: typeof assignment.data?.plans?.slug === "string" ? assignment.data.plans.slug : "standard",
    entitledModules: (modules.data ?? []).map((row: unknown) => (row as { modules?: { slug?: unknown } }).modules?.slug).filter((value: unknown): value is string => typeof value === "string"),
  };
}

const CANONICAL_MODULE_POLICY = {
  dependencies: [], conflicts: [], requiredCapabilities: [], allowedRoles: ["agent", "manager", "admin"], risk: "P4" as const, requiresApproval: false,
};

function canonicalModule(module: ModuleContract): ModuleContract {
  return { id: module.id, version: module.version, ...CANONICAL_MODULE_POLICY };
}

function policyDiverges(module: ModuleContract): boolean {
  return JSON.stringify({ dependencies: module.dependencies, conflicts: module.conflicts, requiredCapabilities: module.requiredCapabilities, allowedRoles: module.allowedRoles, risk: module.risk, requiresApproval: module.requiresApproval }) !== JSON.stringify(CANONICAL_MODULE_POLICY);
}

export function authorizeModuleForContext(input: {
  requestId: string; organizationId: string; actorId: string; role: string; capabilities?: string[];
  plan: string; entitledModules: string[]; request: EntitlementRequest;
}): AuthorizationDecision {
  const request = entitlementRequestSchema.parse(input.request);
  const baseInput = buildEntitlementInput({
    requestId: input.requestId, policyVersion: "entitlements.v1", module: canonicalModule(request.module),
    organizationId: input.organizationId, plan: input.plan, entitledModules: input.entitledModules,
    actorId: input.actorId, role: input.role, capabilities: input.capabilities,
    enabledModules: request.enabled_modules, maxRisk: request.max_risk,
    approval: { required: request.approval.required, approved: request.approval.approved, approvalId: request.approval.approval_id },
  });
  return policyDiverges(request.module) ? denyAuthorizationContract({ ...baseInput, module: request.module }) : authorizeModule(baseInput);
}

export function decisionPayload(decision: AuthorizationDecision) {
  return decision.decision === "ALLOW"
    ? { decision: "ALLOW" as const, policyVersion: decision.policyVersion, receipt: decision.audit }
    : { decision: "DENY" as const, reason: decision.reason, policyVersion: decision.policyVersion, receipt: decision.audit };
}
