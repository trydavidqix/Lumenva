/**
 * GET /api/v1/lgpd/requests/[id]/export
 *
 * Provider-free export endpoint. The ZIP contains the canonical JSON payload
 * and a manifest; PAdES signing, Storage and delivery stay explicit follow-ups.
 */
import { randomUUID } from "node:crypto";
import { strToU8, zipSync } from "fflate";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectExportData } from "@/lib/lgpd/export-collector";
import { lgpdExportPackageSchema, lgpdExportQuerySchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "lgpd_requests", allowPlatformAdmin: true });
  if (!authz.ok) return authz.response;

  const parsed = lgpdExportQuerySchema.safeParse({ format: req.nextUrl.searchParams.get("format") ?? undefined });
  if (!parsed.success) return fail("validation_failed", "Formato de exportação inválido.", 422, { details: parsed.error.flatten(), requestId });
  const { id } = await params;
  const { data: request, error } = await createAdminClient()
    .from("lgpd_requests")
    .select("id, organization_id, request_type, contact_id, external_customer_id, status")
    .eq("organization_id", authz.org.orgId).eq("id", id).maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!request) return fail("not_found", "Solicitação não encontrada.", 404, { requestId });
  if (request.request_type !== "data_request") return fail("invalid_request_type", "A solicitação não é um pedido de exportação.", 422, { requestId });
  if (parsed.data.format === "pdf") return fail("export_pdf_unavailable", "PDF PAdES ainda requer configuração F6 de assinatura e Storage.", 501, { requestId });

  const payload = await collectExportData({ organizationId: authz.org.orgId, requestId: id, contactId: request.contact_id, externalCustomerId: request.external_customer_id });
  if (parsed.data.format === "json") return ok({ request_id: id, status: request.status, format: "json", signed: false, delivery: "not_configured", data: payload }, { requestId });

  const generatedAt = payload.generated_at;
  const manifest = lgpdExportPackageSchema.parse({ version: "f6", request_id: id, generated_at: generatedAt, signed_pades: false, files: [
    { name: "data.json", media_type: "application/json" },
    { name: "manifest.json", media_type: "application/json" },
  ] });
  const dataJson = JSON.stringify(payload, null, 2);
  const manifestJson = JSON.stringify(manifest, null, 2);
  const zip = zipSync({ "data.json": strToU8(dataJson), "manifest.json": strToU8(manifestJson) });
  return new Response(zip, { status: 200, headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="lgpd-${id}.zip"`, "x-lgpd-signed-pades": "false" } });
}
