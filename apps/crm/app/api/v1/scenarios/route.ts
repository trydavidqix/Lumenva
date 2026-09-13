import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseCreateScenarioInput } from "@/lib/agent-engine/scenario/api-schema";
import { getScenarioRuntimeConfig } from "@/lib/agent-engine/scenario/config";
import { getScenarioRepository } from "@/lib/agent-engine/scenario/runtime";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "scenarios" });
  if (!authz.ok) return authz.response;

  const rawLimit = Number(req.nextUrl.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.trunc(rawLimit))) : 50;
  try {
    const scenarios = await getScenarioRepository().listScenarios(authz.org.orgId, limit);
    return ok({ scenarios }, { requestId });
  } catch {
    return fail("internal_error", "Não foi possível listar os cenários.", 500, { requestId });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "scenarios" });
  if (!authz.ok) return authz.response;

  const body = await req.json().catch(() => null);
  try {
    const config = getScenarioRuntimeConfig();
    const input = parseCreateScenarioInput(body, {
      maxRuns: config.maxRuns,
      maxRuntimeMs: config.maxRuntimeMs,
    });
    const scenario = await getScenarioRepository().createScenario(authz.org.orgId, {
      ...input,
      createdBy: authz.user.id,
    });
    return ok({ scenario }, { status: 201, requestId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail("validation_failed", "Dados do cenário inválidos.", 422, {
        requestId,
        details: error.flatten(),
      });
    }
    return fail("internal_error", "Não foi possível criar o cenário.", 500, { requestId });
  }
}
