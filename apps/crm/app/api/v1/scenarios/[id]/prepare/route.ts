import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { prepareScenario } from "@/lib/agent-engine/scenario/prepare";
import { getScenarioDbPool } from "@/lib/agent-engine/scenario/runtime";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Prepares a DRAFT scenario: bounded Council proposal/challenge, baseline,
 * synthetic actor template and canonical lifecycle transitions up to READY.
 */
export async function POST(_req: NextRequest, { params }: RouteParams): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "scenarios" });
  if (!authz.ok) return authz.response;
  const { id } = await params;

  try {
    const setup = await prepareScenario(getScenarioDbPool(), authz.org.orgId, id);
    return ok({ setup }, { requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not found/i.test(message)) return fail("not_found", "Cenário não encontrado.", 404, { requestId });
    if (/expected DRAFT/i.test(message)) {
      return fail("conflict", "Só cenários em rascunho podem ser preparados.", 409, { requestId });
    }
    return fail("internal_error", "Não foi possível preparar o cenário.", 500, { requestId });
  }
}
