/**
 * GET /api/v1/workflows/:thread_id — busca um workflow (manager+, org-scoped).
 *
 * Isolamento de tenant é por `thread_id` + `organization_id` na MESMA query
 * (constraint `ai_workflow_runs_thread_unique (organization_id, thread_id)`
 * já garante que o par é único, mas a busca teria que filtrar org de
 * qualquer forma — thread_id sozinho não prova posse). Devolve a linha
 * inteira, incluindo `draft_payload`/`decision_payload`, porque só chega
 * até aqui quem já é manager+ da própria org (RLS da tabela também é
 * manager+, defesa em profundidade).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

import { WORKFLOW_RUN_COLUMNS, isUuid, type AiWorkflowRunRow } from "../_shared";

export const dynamic = "force-dynamic";

interface RouteCtx {
  params: Promise<{ thread_id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { thread_id: threadId } = await ctx.params;

  if (!isUuid(threadId)) {
    return fail("invalid_request", "thread_id inválido.", 400, { requestId });
  }

  const authz = await requireRole("manager", { requestId, resource: "ai_workflow_runs" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_workflow_runs")
    .select(WORKFLOW_RUN_COLUMNS)
    .eq("thread_id", threadId)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("not_found", "Workflow não encontrado.", 404, { requestId });

  return ok(data as AiWorkflowRunRow, { requestId });
}
