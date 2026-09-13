import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "revenue_attribution" });
  if (!authz.ok) return authz.response;
  const conversionId = req.nextUrl.searchParams.get("conversionId");
  if (!conversionId) return fail("validation_failed", "conversionId is required", 422, { requestId });
  const organizationId = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.from("attributions")
    .select("id,sale_id,affiliate_conversion_id,creator_profile_id,product_id,offer_id,campaign_id,creative_variant_id,conversion_id,attribution_model,confidence_bps,evidence_refs,created_at")
    .eq("organization_id", organizationId).eq("conversion_id", conversionId).order("created_at", { ascending: true }).limit(100);
  return ok({ organizationId, conversionId, attributions: data ?? [], stale: Boolean(error) }, { requestId });
}
