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
 * Requests execution only. The HTTP request never runs the multi-seed simulation
 * inline; an event_log consumer owns orchestration/retries outside the request.
 */
export async function POST(_req: NextRequest, { params }: RouteParams): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "scenarios" });
  if (!authz.ok) return authz.response;
  const { id } = await params;

  try {
    const scenario = await getScenarioRepository().requestRun(authz.org.orgId, id, requestId);
    return ok(
      {
        scenario,
        runRequestEventId: scenario.run_request_event_id ?? null,
        queued: true,
      },
      { requestId },
    );
  } catch (error) {
    if (error instanceof Error && /expected READY/i.test(error.message)) {
      const existing = await getScenarioRepository().getScenario(authz.org.orgId, id).catch(() => null);
      if (!existing) return fail("not_found", "Cenário não encontrado.", 404, { requestId });
      return fail("conflict", "O cenário precisa estar READY para iniciar uma nova execução.", 409, {
        requestId,
        details: { status: existing.status ?? null },
      });
    }
    return fail("internal_error", "Não foi possível enfileirar a execução do cenário.", 500, { requestId });
  }
}
