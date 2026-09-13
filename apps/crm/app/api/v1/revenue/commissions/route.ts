import { randomUUID } from "node:crypto";
import { ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "revenue_commissions" });
  if (!authz.ok) return authz.response;
  const organizationId = authz.org.orgId;
  const supabase = await createClient();
  const [commissions, payouts] = await Promise.all([
    supabase.from("commissions").select("id,affiliate_conversion_id,provider,external_id,status,amount_minor,currency,occurred_at,approved_at,paid_at").eq("organization_id", organizationId).order("occurred_at", { ascending: false }).limit(250),
    supabase.from("payouts").select("id,program_id,provider,external_id,status,amount_minor,currency,occurred_at").eq("organization_id", organizationId).order("occurred_at", { ascending: false }).limit(250),
  ]);
  return ok({ organizationId, commissions: commissions.data ?? [], payouts: payouts.data ?? [], stale: Boolean(commissions.error || payouts.error) }, { requestId });
}
