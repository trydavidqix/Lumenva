import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createMobileComplianceReadModel } from "@/lib/product-factory/mobile-compliance/read-model";
import { createSupabaseMobileComplianceRepository } from "@/lib/product-factory/mobile-compliance/supabase-read-repository";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  project_id: z.string().trim().min(1).max(200).optional(),
  verdict: z.enum(["PASS", "PASS_WITH_WARNINGS", "NEEDS_REVIEW", "BLOCK"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "mobile_compliance_reports",
  });
  if (!authz.ok) return authz.response;

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries()),
  );
  if (!parsed.success) {
    return fail("validation_failed", "Filtros inválidos.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  try {
    const readModel = createMobileComplianceReadModel(
      createSupabaseMobileComplianceRepository(),
    );
    const reports = await readModel.listReports(authz.org.orgId, {
      ...(parsed.data.project_id ? { projectId: parsed.data.project_id } : {}),
      ...(parsed.data.verdict ? { verdict: parsed.data.verdict } : {}),
      limit: parsed.data.limit,
    });
    return ok({ reports }, { requestId });
  } catch {
    return fail("internal_error", "Falha ao carregar os relatórios de release.", 500, {
      requestId,
    });
  }
}
