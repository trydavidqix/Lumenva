import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseUpdateScenarioInput } from "@/lib/agent-engine/scenario/api-schema";
import { getScenarioRepository } from "@/lib/agent-engine/scenario/runtime";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "scenarios" });
  if (!authz.ok) return authz.response;
  const { id } = await params;

  try {
    const scenario = await getScenarioRepository().getScenario(authz.org.orgId, id);
    if (!scenario) return fail("not_found", "Cenário não encontrado.", 404, { requestId });
    return ok({ scenario }, { requestId });
  } catch {
    return fail("internal_error", "Não foi possível carregar o cenário.", 500, { requestId });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "scenarios" });
  if (!authz.ok) return authz.response;
  const { id } = await params;
  const body = await req.json().catch(() => null);

  try {
    const input = parseUpdateScenarioInput(body);
    const scenario = await getScenarioRepository().updateDraft(authz.org.orgId, id, input);
    return ok({ scenario }, { requestId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail("validation_failed", "Alterações do cenário inválidas.", 422, {
        requestId,
        details: error.flatten(),
      });
    }
    if (error instanceof Error && /expected DRAFT/i.test(error.message)) {
      const existing = await getScenarioRepository().getScenario(authz.org.orgId, id).catch(() => null);
      if (!existing) return fail("not_found", "Cenário não encontrado.", 404, { requestId });
      return fail("conflict", "Só cenários em rascunho podem ser editados.", 409, { requestId });
    }
    return fail("internal_error", "Não foi possível atualizar o cenário.", 500, { requestId });
  }
}
