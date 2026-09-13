import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createMobileComplianceReadModel } from "@/lib/product-factory/mobile-compliance/read-model";
import { createSupabaseMobileComplianceRepository } from "@/lib/product-factory/mobile-compliance/supabase-read-repository";

export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };
const idSchema = z.string().trim().min(1).max(200);

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "mobile_compliance_reports",
  });
  if (!authz.ok) return authz.response;

  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) {
    return fail("validation_failed", "Relatório inválido.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  try {
    const readModel = createMobileComplianceReadModel(
      createSupabaseMobileComplianceRepository(),
    );
    const result = await readModel.getReport(authz.org.orgId, parsed.data);
    if (!result) {
      return fail("not_found", "Relatório de release não encontrado.", 404, {
        requestId,
      });
    }
    return ok(result, { requestId });
  } catch {
    return fail("internal_error", "Falha ao carregar o relatório de release.", 500, {
      requestId,
    });
  }
}
