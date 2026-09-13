import { randomUUID } from "node:crypto";
import { ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "creator_commerce_overview" });
  if (!authz.ok) return authz.response;
  const organizationId = authz.org.orgId;
  const supabase = await createClient();

  const [creators, products, campaigns, experiments, snapshots] = await Promise.all([
    supabase.from("creator_profiles").select("id,handle,display_name,status,market,language").eq("organization_id", organizationId).limit(100),
    supabase.from("commerce_products").select("id,canonical_sku,title,status").eq("organization_id", organizationId).limit(100),
    supabase.from("commerce_campaigns").select("id,name,status,market,language").eq("organization_id", organizationId).limit(100),
    supabase.from("commerce_experiments").select("id,name,status,primary_metric,starts_at,ends_at").eq("organization_id", organizationId).limit(100),
    supabase.from("revenue_snapshots").select("period_start,period_end,currency,gmv_minor,gross_revenue_minor,net_revenue_minor,commission_pending_minor,commission_approved_minor,commission_paid_minor,generated_at").eq("organization_id", organizationId).order("generated_at", { ascending: false }).limit(1),
  ]);

  return ok({
    organizationId,
    creators: creators.data ?? [],
    products: products.data ?? [],
    campaigns: campaigns.data ?? [],
    experiments: experiments.data ?? [],
    latestRevenue: snapshots.data?.[0] ?? null,
    stale: [creators, products, campaigns, experiments, snapshots].some((result) => Boolean(result.error)),
  }, { requestId });
}
