import { type NextRequest } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { authorizeModule, type AuthorizeModuleInput, type ApprovalContext, type ModuleContract, type ModuleRiskTier } from "@/lib/entitlements/authorize-module";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/api/wrappers";

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

export function buildEntitlementInput(input: {
  requestId: string; policyVersion: string; module: ModuleContract; organizationId: string; plan: string;
  entitledModules: string[]; actorId: string; role: string; actorCapabilities?: string[]; enabledModules: string[]; maxRisk: ModuleRiskTier; approval: ApprovalContext;
}): AuthorizeModuleInput {
  return {
    requestId: input.requestId, policyVersion: input.policyVersion, module: input.module,
    tenant: { organizationId: input.organizationId, rlsOrganizationId: input.organizationId, rlsAllowed: true, plan: input.plan, entitledModules: input.entitledModules },
    actor: { actorId: input.actorId, organizationId: input.organizationId, role: input.role, capabilities: input.actorCapabilities ?? [] },
    enabledModules: input.enabledModules, maxRisk: input.maxRisk, approval: input.approval,
  };
}

export function evaluateEntitlementRequest(input: {
  requestId: string; module: ModuleContract; organizationId: string; actorId: string; role: string;
  actorCapabilities?: string[]; enabledModules: string[]; maxRisk: ModuleRiskTier; approval: ApprovalContext;
}, catalog: { plan: string; entitledModules: string[] }) {
  return authorizeModule(buildEntitlementInput({
    ...input, policyVersion: "entitlements.v1", plan: catalog.plan, entitledModules: catalog.entitledModules,
  }));
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "entitlements" });
  if (!authz.ok) return authz.response;
  let body: unknown;
  try { body = await req.json(); } catch { return fail("validation_error", "Invalid JSON body", 400, { requestId }); }
  const parsed = entitlementRequestSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid entitlement request", 400, { requestId, details: parsed.error.flatten() });

  const supabase = await createClient();
  const db = supabase as any;
  const assignment = await db.from("organization_plan").select("plan_id, plans!inner(slug)").eq("organization_id", authz.org.orgId).eq("status", "active").maybeSingle();
  if (assignment.error) return fail("internal_error", assignment.error.message, 500, { requestId });
  const modules = assignment.data ? await db.from("plan_modules").select("modules!inner(slug)").eq("plan_id", assignment.data.plan_id) : { data: [], error: null };
  if (modules.error) return fail("internal_error", modules.error.message, 500, { requestId });
  const plan = typeof assignment.data?.plans?.slug === "string" ? assignment.data.plans.slug : "standard";
  const entitledModules = (modules.data ?? []).map((row: any) => row.modules?.slug).filter((v: unknown): v is string => typeof v === "string");
  const actorCapabilities = (authz.user as unknown as { capabilities?: unknown }).capabilities;
  const trustedCapabilities = Array.isArray(actorCapabilities) ? actorCapabilities.filter((v): v is string => typeof v === "string") : [];
  const decision = authorizeModule(buildEntitlementInput({
    requestId, policyVersion: "entitlements.v1", module: parsed.data.module, organizationId: authz.org.orgId, plan, entitledModules,
    actorId: authz.user.id, role: authz.org.role, actorCapabilities: trustedCapabilities, enabledModules: parsed.data.enabled_modules, maxRisk: parsed.data.max_risk,
    approval: { required: parsed.data.approval.required, approved: parsed.data.approval.approved, approvalId: parsed.data.approval.approval_id },
  }));
  if (decision.decision === "DENY") return fail("entitlement_denied", "Entitlement denied", 403, { requestId, details: { receipt: decision } });
  return ok({ decision: "ALLOW", receipt: decision }, { requestId });
}
