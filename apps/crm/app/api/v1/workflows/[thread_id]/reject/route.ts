/**
 * PATCH /api/v1/workflows/:thread_id/reject — manager rejeita o workflow.
 *
 * Mesmo padrão de `../approve/route.ts`: só a partir de `awaiting_approval`,
 * NO-OP idempotente se já `rejected`, 409 `invalid_state` de qualquer outro
 * estado. Rejeitar nunca envia nada — `send_once` (Task 8 do plano) só roda
 * a partir de `approved`.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

import { applyWorkflowDecision, isUuid } from "../../_shared";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ thread_id: string }>;
}

const bodySchema = z.object({ reason: z.string().trim().min(1).max(2000).optional() });

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { thread_id: threadId } = await ctx.params;

  if (!isUuid(threadId)) {
    return fail("invalid_request", "thread_id inválido.", 400, { requestId });
  }

  const authz = await requireRole("manager", { requestId, resource: "ai_workflow_runs" });
  if (!authz.ok) return authz.response;
  const { user, org: activeOrg } = authz;

  let reason: string | undefined;
  const rawBody = await req.text();
  if (rawBody.trim().length > 0) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
    }
    const parsed = bodySchema.safeParse(parsedJson);
    if (!parsed.success) {
      return fail("validation_failed", "Campos inválidos.", 422, {
        requestId,
        details: parsed.error.flatten(),
      });
    }
    reason = parsed.data.reason;
  }

  const supabase = await createClient();
  return applyWorkflowDecision(supabase, {
    organizationId: activeOrg.orgId,
    threadId,
    userId: user.id,
    target: "rejected",
    decisionPayload: reason ? { reason } : {},
    auditAction: "workflow.rejected",
    requestId,
  });
}
