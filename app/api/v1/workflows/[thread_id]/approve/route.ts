/**
 * PATCH /api/v1/workflows/:thread_id/approve — manager aprova o workflow.
 *
 * Só transiciona a partir de `awaiting_approval`. Reaprovar um workflow já
 * `approved` é NO-OP idempotente (200, mesmo `decided_by`/`decided_at` de
 * quando decidiu pela primeira vez). Qualquer outro estado atual → 409
 * `invalid_state`. Ver `../_shared.ts` (`applyWorkflowDecision`) para a
 * corrida contra `reject`/outra `approve` concorrente.
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

const bodySchema = z.object({ note: z.string().trim().min(1).max(2000).optional() });

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { thread_id: threadId } = await ctx.params;

  if (!isUuid(threadId)) {
    return fail("invalid_request", "thread_id inválido.", 400, { requestId });
  }

  const authz = await requireRole("manager", { requestId, resource: "ai_workflow_runs" });
  if (!authz.ok) return authz.response;
  const { user, org: activeOrg } = authz;

  let note: string | undefined;
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
    note = parsed.data.note;
  }

  const supabase = await createClient();
  return applyWorkflowDecision(supabase, {
    organizationId: activeOrg.orgId,
    threadId,
    userId: user.id,
    target: "approved",
    decisionPayload: note ? { note } : {},
    auditAction: "workflow.approved",
    requestId,
  });
}
