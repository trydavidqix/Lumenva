import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAgentCommandRuntime } from "@/lib/ai/agent-command/runtime";
import { AgentCommandError } from "@/lib/ai/agent-command/service";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = z.string().uuid();
const bodySchema = z
  .object({
    command: z.string().trim().min(1).max(8_000),
  })
  .strict();

type Ctx = { params: Promise<{ id: string }> };

function commandError(error: unknown, requestId: string): Response {
  if (error instanceof AgentCommandError) {
    return fail(error.code, error.code, error.status, {
      requestId,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
  }
  return fail("internal_error", "Não foi possível processar o comando do agente.", 500, {
    requestId,
  });
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  if (!UUID.safeParse(id).success) {
    return fail("invalid_request", "id inválido.", 400, { requestId });
  }

  const authz = await requireRole("manager", { requestId, resource: "ai_agents" });
  if (!authz.ok) return authz.response;

  const rateLimit = await checkRateLimit(
    `ai_agent_command:${authz.org.orgId}:${authz.user.id}`,
    30,
    60,
  );
  if (!rateLimit.allowed) {
    return fail("rate_limited", "Muitos comandos em pouco tempo.", 429, {
      requestId,
      headers: { "Retry-After": "60" },
    });
  }

  const idempotencyKey = req.headers.get("idempotency-key");
  if (!idempotencyKey || !UUID.safeParse(idempotencyKey).success) {
    return fail("invalid_request", "Idempotency-Key UUID é obrigatório.", 400, {
      requestId,
    });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", "Comando inválido.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await getAgentCommandRuntime().submit({
      organizationId: authz.org.orgId,
      userId: authz.user.id,
      agentId: id,
      command: parsed.data.command,
      idempotencyKey,
      requestId,
    });
    return ok(result, { requestId });
  } catch (error) {
    return commandError(error, requestId);
  }
}
