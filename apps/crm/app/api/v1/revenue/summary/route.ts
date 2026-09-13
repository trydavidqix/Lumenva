import { randomUUID } from "node:crypto";
import { ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "revenue_summary" });
  if (!authz.ok) return authz.response;
  const organizationId = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.from("revenue_snapshots")
    .select("period_start,period_end,currency,gmv_minor,gross_revenue_minor,net_revenue_minor,refund_minor,chargeback_minor,commission_pending_minor,commission_approved_minor,commission_paid_minor,dimensions,generated_at")
    .eq("organization_id", organizationId).order("generated_at", { ascending: false }).limit(30);
  return ok({ organizationId, snapshots: data ?? [], stale: Boolean(error) }, { requestId });
}
