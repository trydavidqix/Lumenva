import { type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { fail, ok } from "@/lib/api/wrappers";
import { authorizeModuleForContext, decisionPayload, entitlementRequestSchema, readOrganizationEntitlements } from "@/lib/entitlements/adapter";

export { entitlementRequestSchema, buildEntitlementInput, evaluateEntitlementRequest } from "@/lib/entitlements/adapter";

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "entitlements" });
  if (!authz.ok) return authz.response;
  let body: unknown;
  try { body = await req.json(); } catch { return fail("validation_error", "Invalid JSON body", 400, { requestId }); }
  const parsed = entitlementRequestSchema.safeParse(body);
  if (!parsed.success) return fail("validation_error", "Invalid entitlement request", 400, { requestId, details: parsed.error.flatten() });

  const supabase = await createClient();
  let tenant: Awaited<ReturnType<typeof readOrganizationEntitlements>>;
  try { tenant = await readOrganizationEntitlements(supabase, authz.org.orgId); }
  catch (error) { return fail("internal_error", error instanceof Error ? error.message : "Entitlement lookup failed", 500, { requestId }); }
  const decision = authorizeModuleForContext({
    requestId, organizationId: authz.org.orgId, actorId: authz.user.id, role: authz.org.role,
    ...tenant, request: parsed.data,
  });
  const payload = decisionPayload(decision);
  if (decision.decision === "DENY") return fail("entitlement_denied", "Entitlement denied", 403, { requestId, details: payload });
  return ok(payload, { requestId });
}
