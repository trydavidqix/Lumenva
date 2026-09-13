import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "creator_commerce_products" });
  if (!authz.ok) return authz.response;
  const organizationId = authz.org.orgId;
  const supabase = await createClient();
  const status = req.nextUrl.searchParams.get("status");
  let query = supabase.from("commerce_products").select("id,canonical_sku,title,description,status,updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(250);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  return ok({ organizationId, products: data ?? [], stale: Boolean(error) }, { requestId });
}
