import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { getScenarioRepository } from "@/lib/agent-engine/scenario/runtime";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Returns the latest persisted decision brief for a scenario in the active
 * organization. Synthetic reports remain advisory and are never CRM facts.
 */
export async function GET(_req: NextRequest, { params }: RouteParams): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "scenarios" });
  if (!authz.ok) return authz.response;
  const { id } = await params;

  try {
    const repository = getScenarioRepository();
    const scenario = await repository.getScenario(authz.org.orgId, id);
    if (!scenario) return fail("not_found", "Cenário não encontrado.", 404, { requestId });

    const report = await repository.getLatestReport(authz.org.orgId, id);
    if (!report) return fail("not_found", "O relatório deste cenário ainda não foi gerado.", 404, { requestId });

    return ok({ report }, { requestId });
  } catch {
    return fail("internal_error", "Não foi possível carregar o relatório do cenário.", 500, { requestId });
  }
}
