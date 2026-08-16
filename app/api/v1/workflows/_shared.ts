/**
 * Compartilhado entre as rotas `app/api/v1/workflows/*` (Fase 7 LangGraph,
 * Task 3 do plano — API de workflow, CRUD direto sobre `ai_workflow_runs`;
 * NÃO invoca o grafo LangGraph ainda, que é escopo das Tasks 4-9 do plano
 * `docs/superpowers/plans/2026-08-10-ai-platform-phase-7-langgraph.md`).
 *
 * `lib/database.types.ts` ainda não inclui `ai_workflow_runs` (mesma lacuna
 * já registrada no relatório da Task 2 — sem sessão local do Supabase CLI
 * wired para `generate_typescript_types` neste ambiente). Mesma solução já
 * usada em `lib/agent-engine/platform/features.ts` para
 * `ai_platform_feature_flags`: tipo local + cast na borda do cliente
 * Supabase, sem editar o arquivo gerado à mão.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { FeatureMode } from "@/lib/agent-engine/platform/contracts";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import type { AuditAction } from "@/lib/audit/actions";

export const WORKFLOW_TYPE = "commercial_proposal" as const;
export type WorkflowType = typeof WORKFLOW_TYPE;

export type WorkflowStatus =
  | "shadow"
  | "drafting"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "sending"
  | "completed"
  | "failed"
  | "cancelled";

export interface AiWorkflowRunRow {
  id: string;
  organization_id: string;
  workflow_type: WorkflowType;
  thread_id: string;
  contact_id: string;
  conversation_id: string | null;
  lead_id: string | null;
  status: WorkflowStatus;
  draft_payload: Record<string, unknown>;
  decision_payload: Record<string, unknown> | null;
  decided_by: string | null;
  decided_at: string | null;
  side_effect_key: string;
  sent_message_id: string | null;
  followup_id: string | null;
  last_error_code: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const WORKFLOW_RUN_COLUMNS =
  "id, organization_id, workflow_type, thread_id, contact_id, conversation_id, lead_id, status, draft_payload, decision_payload, decided_by, decided_at, side_effect_key, sent_message_id, followup_id, last_error_code, created_by, created_at, updated_at";

export const ENDPOINT_TAG = "/api/v1/workflows";

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RX.test(value);
}

/**
 * `off` nunca cria linha (bloqueado antes desta função ser chamada — ver
 * rota). `shadow` nasce `shadow` (drafts avaliados, sem side effect real,
 * sem exigir aprovação humana de verdade — doutrina da Fase 7). `canary`/`on`
 * nascem `drafting`, o primeiro passo do fluxo real de aprovação.
 */
export function initialStatusForMode(mode: Exclude<FeatureMode, "off">): WorkflowStatus {
  return mode === "shadow" ? "shadow" : "drafting";
}

export interface WorkflowCursor {
  created_at: string;
  id: string;
}

export function encodeWorkflowCursor(c: WorkflowCursor): string {
  return Buffer.from(`${c.created_at}|${c.id}`, "utf8").toString("base64url");
}

export function decodeWorkflowCursor(raw: string): WorkflowCursor | null {
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const [created_at, id] = decoded.split("|");
    if (!created_at || !id) return null;
    return { created_at, id };
  } catch {
    return null;
  }
}

type DecisionTarget = "approved" | "rejected";

/**
 * Compartilhado por `[thread_id]/approve` e `[thread_id]/reject`.
 *
 * Estado alvo idêntico ao atual → NO-OP idempotente (200, sem re-audit, sem
 * tocar `decided_by`/`decided_at` — a decisão já registrada é a fonte da
 * verdade, reaprovar não deve reescrever quem/quando decidiu). Estado atual
 * fora de `awaiting_approval`/alvo → 409 `invalid_state`. Caso contrário,
 * UPDATE condicional `WHERE status = 'awaiting_approval'` fecha a corrida
 * (mesmo padrão de `app/api/v1/leads/[id]/reactivation/route.ts`): quem
 * perder a corrida recebe 409 em vez de sobrescrever a decisão de quem
 * chegou primeiro.
 */
export async function applyWorkflowDecision(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: {
    organizationId: string;
    threadId: string;
    userId: string;
    target: DecisionTarget;
    decisionPayload: Record<string, unknown>;
    auditAction: AuditAction;
    requestId: string;
  },
): Promise<Response> {
  const { organizationId, threadId, userId, target, decisionPayload, auditAction, requestId } = input;

  const { data: current, error: fetchErr } = await supabase
    .from("ai_workflow_runs")
    .select(WORKFLOW_RUN_COLUMNS)
    .eq("thread_id", threadId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (fetchErr) return fail("internal_error", fetchErr.message, 500, { requestId });
  if (!current) return fail("not_found", "Workflow não encontrado.", 404, { requestId });

  const row = current as AiWorkflowRunRow;

  if (row.status === target) {
    // Idempotente: já decidido para o mesmo alvo. Devolve o estado atual sem
    // reescrever decided_by/decided_at nem reemitir audit.
    return ok(row, { requestId });
  }

  if (row.status !== "awaiting_approval") {
    return fail(
      "invalid_state",
      `Workflow está em '${row.status}', não pode ser decidido a partir deste estado.`,
      409,
      { requestId },
    );
  }

  const decidedAt = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from("ai_workflow_runs")
    .update({
      status: target,
      decided_by: userId,
      decided_at: decidedAt,
      decision_payload: decisionPayload,
    })
    .eq("thread_id", threadId)
    .eq("organization_id", organizationId)
    .eq("status", "awaiting_approval")
    .select(WORKFLOW_RUN_COLUMNS)
    .maybeSingle();

  if (updateErr) return fail("internal_error", updateErr.message, 500, { requestId });
  if (!updated) {
    // Corrida perdida entre o SELECT acima e este UPDATE: outra requisição
    // decidiu primeiro. Devolve o estado real em vez de fingir sucesso.
    const { data: latest } = await supabase
      .from("ai_workflow_runs")
      .select(WORKFLOW_RUN_COLUMNS)
      .eq("thread_id", threadId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    const latestRow = latest as AiWorkflowRunRow | null;
    if (latestRow?.status === target) return ok(latestRow, { requestId });
    return fail(
      "invalid_state",
      `Workflow não está mais em 'awaiting_approval' (estado atual: ${latestRow?.status ?? "desconhecido"}).`,
      409,
      { requestId },
    );
  }

  const updatedRow = updated as AiWorkflowRunRow;

  void audit({
    action: auditAction,
    actorUserId: userId,
    organizationId,
    resourceType: "ai_workflow_run",
    resourceId: updatedRow.id,
    requestId,
    metadata: { thread_id: updatedRow.thread_id, status: updatedRow.status },
  });

  return ok(updatedRow, { requestId });
}
