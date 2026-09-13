import { randomUUID } from "node:crypto";
import { ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "creator_commerce_creators" });
  if (!authz.ok) return authz.response;
  const organizationId = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.from("creator_profiles")
    .select("id,handle,display_name,status,market,language,updated_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(250);
  return ok({ organizationId, creators: data ?? [], stale: Boolean(error) }, { requestId });
}
