import { randomUUID } from "node:crypto";
import { ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "creator_commerce_experiments" });
  if (!authz.ok) return authz.response;
  const organizationId = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.from("commerce_experiments")
    .select("id,campaign_id,name,hypothesis,primary_metric,minimum_sample_size,minimum_window_seconds,status,starts_at,ends_at,updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(250);
  return ok({ organizationId, experiments: data ?? [], stale: Boolean(error) }, { requestId });
}
