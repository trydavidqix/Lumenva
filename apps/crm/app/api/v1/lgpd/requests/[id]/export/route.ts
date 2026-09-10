/**
 * GET /api/v1/lgpd/requests/[id]/export
 *
 * Provider-free export scaffold: returns the canonical JSON payload collected
 * from tenant-scoped data. PDF signing, Storage and delivery remain explicit
 * F6 follow-ups and are never represented as completed here.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { collectExportData } from "@/lib/lgpd/export-collector";
import { lgpdExportQuerySchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", {
    requestId,
    resource: "lgpd_requests",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;

  const parsed = lgpdExportQuerySchema.safeParse({
    format: req.nextUrl.searchParams.get("format") ?? undefined,
  });
  if (!parsed.success) {
    return fail("validation_failed", "Formato de exportação inválido.", 422, {
      details: parsed.error.flatten(),
      requestId,
    });
  }
  if (parsed.data.format === "pdf") {
    return fail(
      "export_pdf_unavailable",
      "PDF PAdES ainda requer a configuração F6 de assinatura e Storage.",
      501,
      { requestId },
    );
  }

  const { id } = await params;
  const { data: request, error } = await createAdminClient()
    .from("lgpd_requests")
    .select("id, organization_id, request_type, contact_id, external_customer_id, status")
    .eq("organization_id", authz.org.orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!request) return fail("not_found", "Solicitação não encontrada.", 404, { requestId });
  if (request.request_type !== "data_request") {
    return fail("invalid_request_type", "A solicitação não é um pedido de exportação.", 422, { requestId });
  }

  const payload = await collectExportData({
    organizationId: authz.org.orgId,
    requestId: id,
    contactId: request.contact_id,
    externalCustomerId: request.external_customer_id,
  });

  return ok(
    {
      request_id: id,
      status: request.status,
      format: "json",
      signed: false,
      delivery: "not_configured",
      data: payload,
    },
    { requestId },
  );
}
