import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizeModule, type AuthorizeModuleInput, type ApprovalContext, type AuthorizationDecision, type ModuleContract, type ModuleRiskTier } from "./authorize-module";

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
  const { data, error } = await supabase.from("organizations").select("settings").eq("id", organizationId).single();
  if (error) throw new Error(error.message);
  const settings = data?.settings && typeof data.settings === "object" ? data.settings as Record<string, unknown> : {};
  return {
    plan: typeof settings.plan === "string" ? settings.plan : "standard",
    entitledModules: Array.isArray(settings.entitled_modules) ? settings.entitled_modules.filter((value): value is string => typeof value === "string") : [],
  };
}

export function authorizeModuleForContext(input: {
  requestId: string; organizationId: string; actorId: string; role: string; capabilities?: string[];
  plan: string; entitledModules: string[]; request: EntitlementRequest;
}): AuthorizationDecision {
  const request = entitlementRequestSchema.parse(input.request);
  return authorizeModule(buildEntitlementInput({
    requestId: input.requestId, policyVersion: "entitlements.v1", module: request.module,
    organizationId: input.organizationId, plan: input.plan, entitledModules: input.entitledModules,
    actorId: input.actorId, role: input.role, capabilities: input.capabilities,
    enabledModules: request.enabled_modules, maxRisk: request.max_risk,
    approval: { required: request.approval.required, approved: request.approval.approved, approvalId: request.approval.approval_id },
  }));
}

export function decisionPayload(decision: AuthorizationDecision) {
  return decision.decision === "ALLOW"
    ? { decision: "ALLOW" as const, policyVersion: decision.policyVersion, receipt: decision.audit }
    : { decision: "DENY" as const, reason: decision.reason, policyVersion: decision.policyVersion, receipt: decision.audit };
}
