"use server";

/**
 * Server Action: mark the active org's Nuvemshop integration as disconnected.
 *
 * MVP scope: flips `status='disconnected'`, clears tokens, and audits. Webhook
 * cleanup on Nuvemshop's side is best-effort (deferred to a worker because we
 * may not have a valid token if the disconnect was triggered by token expiry).
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export type DisconnectResult =
  | { ok: true }
  | { ok: false; error: "auth_required" | "no_active_org" | "forbidden" | "not_connected" | "db_error" };

export async function disconnectNuvemshop(): Promise<DisconnectResult> {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id") ?? undefined;

  const authz = await requireRole("admin", { requestId, resource: "tenant_integrations", allowPlatformAdmin: true });
  if (!authz.ok) {
    if (authz.response.status === 401) return { ok: false, error: "auth_required" };
    const code = (await authz.response.json().catch(() => ({})))?.error?.code;
    if (code === "forbidden_tenant" || authz.response.status === 404) return { ok: false, error: "no_active_org" };
    return { ok: false, error: "forbidden" };
  }
  const user = authz.user;
  const activeOrg = authz.org;

  const admin = createAdminClient();
  const { data: existing, error: lookupErr } = await admin
    .from("tenant_integrations")
    .select("id")
    .eq("organization_id", activeOrg.orgId)
    .eq("provider", "nuvemshop")
    .maybeSingle();

  if (lookupErr) return { ok: false, error: "db_error" };
  if (!existing) return { ok: false, error: "not_connected" };

  const { error: updErr } = await admin
    .from("tenant_integrations")
    .update({
      status: "disconnected",
      status_reason: "user_disconnected",
    })
    .eq("id", existing.id);

  if (updErr) return { ok: false, error: "db_error" };

  await audit({
    action: "nuvemshop.disconnected",
    organizationId: activeOrg.orgId,
    actorUserId: user.id,
    resourceType: "tenant_integration",
    resourceId: existing.id,
  });

  revalidatePath("/app/integrations/nuvemshop");
  return { ok: true };
}
