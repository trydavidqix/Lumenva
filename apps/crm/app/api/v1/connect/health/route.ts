import { randomUUID } from "node:crypto";
import { ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "connect_health" });
  if (!authz.ok) return authz.response;
  const organizationId = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.from("tenant_integrations")
    .select("provider,status,updated_at")
    .eq("organization_id", organizationId)
    .limit(250);
  const providers = (data ?? []).map((row: Record<string, unknown>) => ({
    provider: row.provider,
    status: row.status ?? "unknown",
    observedAt: row.updated_at ?? null,
  }));
  return ok({ organizationId, providers, stale: Boolean(error) }, { requestId });
}
