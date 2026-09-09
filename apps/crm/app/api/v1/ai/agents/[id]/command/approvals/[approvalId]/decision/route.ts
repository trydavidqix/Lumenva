import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { getAgentCommandRuntime } from "@/lib/ai/agent-command/runtime";
import { AgentCommandError } from "@/lib/ai/agent-command/service";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = z.string().uuid();
const bodySchema = z
  .object({
    decision: z.enum(["approve", "deny"]),
    reason: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict();

type Ctx = { params: Promise<{ id: string; approvalId: string }> };

function commandError(error: unknown, requestId: string): Response {
  if (error instanceof AgentCommandError) {
    return fail(error.code, error.code, error.status, {
      requestId,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
  }
  return fail("internal_error", "Não foi possível decidir a aprovação.", 500, {
    requestId,
  });
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const requestId = randomUUID();
  const { id, approvalId } = await ctx.params;
  if (!UUID.safeParse(id).success || !UUID.safeParse(approvalId).success) {
    return fail("invalid_request", "ids inválidos.", 400, { requestId });
  }

  const authz = await requireRole("manager", { requestId, resource: "ai_agents" });
  if (!authz.ok) return authz.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", "Decisão inválida.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  try {
    const result = await getAgentCommandRuntime().decide({
      organizationId: authz.org.orgId,
      userId: authz.user.id,
      agentId: id,
      approvalId,
      decision: parsed.data.decision,
      ...(parsed.data.reason === undefined ? {} : { reason: parsed.data.reason }),
      requestId,
    });
    return ok(result, { requestId });
  } catch (error) {
    return commandError(error, requestId);
  }
}
