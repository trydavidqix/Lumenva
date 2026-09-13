import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { evaluateCountryCapability, type ProviderCountryCapabilityEvidence } from "@/lib/creator-commerce/country-capabilities";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "connect_country_capability" });
  if (!authz.ok) return authz.response;
  const provider = req.nextUrl.searchParams.get("provider");
  const country = req.nextUrl.searchParams.get("country")?.toUpperCase();
  const capability = req.nextUrl.searchParams.get("capability");
  if (!provider || !country || !capability) return fail("validation_failed", "provider, country and capability are required", 422, { requestId });
  const organizationId = authz.org.orgId;
  const supabase = await createClient();
  const { data, error } = await supabase.from("provider_country_capabilities")
    .select("provider,country,capability,status,requirements,terms_version,last_verified_at,source,evidence_refs")
    .eq("organization_id", organizationId).eq("provider", provider).eq("country", country).eq("capability", capability).limit(20);
  const records: ProviderCountryCapabilityEvidence[] = (data ?? []).map((row: Record<string, unknown>) => ({
    provider: String(row.provider), country: String(row.country), capability: String(row.capability),
    status: row.status as ProviderCountryCapabilityEvidence["status"],
    requirements: Array.isArray(row.requirements) ? row.requirements.map(String) : [],
    termsVersion: typeof row.terms_version === "string" ? row.terms_version : null,
    lastVerifiedAt: typeof row.last_verified_at === "string" ? row.last_verified_at : null,
    source: String(row.source ?? "unknown"),
    evidenceRefs: Array.isArray(row.evidence_refs) ? row.evidence_refs.map(String) : [],
  }));
  const decision = evaluateCountryCapability({ records });
  return ok({ organizationId, decision, stale: Boolean(error) }, { requestId });
}
