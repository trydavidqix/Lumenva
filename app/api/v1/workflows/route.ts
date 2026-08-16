/**
 * POST /api/v1/workflows — inicia um workflow LangGraph (piloto: proposta
 *                           comercial). manager+, org-scoped. `thread_id` e
 *                           `side_effect_key` são gerados no SERVIDOR — nunca
 *                           aceitos do body (doutrina Fase 7 §"Global
 *                           Constraints" do plano). Honra `Idempotency-Key`
 *                           (TTL 24h) por `.claude/rules/api-contract.md`.
 * GET  /api/v1/workflows — lista workflows da org ativa (manager+), keyset
 *                           pagination (created_at DESC, id DESC), mesmo
 *                           padrão de `app/api/v1/audit/route.ts`.
 *
 * Gate de feature: `ai_platform_feature_flags.feature='langgraph_proposal_workflow'`
 * (lib/agent-engine/platform/features.ts). `mode='off'` (inclui kill switch
 * `AI_PLATFORM_KILL_LANGGRAPH`) bloqueia toda criação nova — run existente
 * permanece visível/consultável (não é este endpoint que a esconde).
 */
import { createHash, randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { resolveAiPlatformFeature } from "@/lib/agent-engine/platform/features";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

import {
  ENDPOINT_TAG,
  WORKFLOW_RUN_COLUMNS,
  WORKFLOW_TYPE,
  decodeWorkflowCursor,
  encodeWorkflowCursor,
  initialStatusForMode,
  type AiWorkflowRunRow,
} from "./_shared";

export const dynamic = "force-dynamic";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

const createSchema = z.object({
  contact_id: z.string().uuid(),
  conversation_id: z.string().uuid().nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
});
type CreateInput = z.infer<typeof createSchema>;

function hashInput(input: CreateInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        contact_id: input.contact_id,
        conversation_id: input.conversation_id ?? null,
        lead_id: input.lead_id ?? null,
      }),
    )
    .digest("hex");
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("manager", { requestId, resource: "ai_workflow_runs" });
  if (!authz.ok) return authz.response;
  const { user, org: activeOrg } = authz;

  const rl = await checkRateLimit(`workflows_create:${activeOrg.orgId}`, 30, 60);
  if (!rl.allowed) {
    return fail("rate_limited", "Muitos workflows iniciados em pouco tempo.", 429, {
      requestId,
      headers: { "Retry-After": "60" },
    });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
  }
  const parsed = createSchema.safeParse(rawBody);
  if (!parsed.success) {
    return fail("validation_failed", "Campos inválidos.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }
  const input = parsed.data;

  const feature = await resolveAiPlatformFeature({
    organizationId: activeOrg.orgId,
    feature: "langgraph_proposal_workflow",
  });
  if (feature.mode === "off") {
    return fail(
      "forbidden",
      "O workflow de proposta comercial está desativado para esta organização.",
      403,
      { requestId, details: { killed: feature.killed } },
    );
  }

  const supabase = await createClient();

  // contact_id é a ÚNICA referência obrigatória — precisa existir NESTA org.
  // FK do banco só garante que a linha existe em `contacts` (qualquer org);
  // quem garante o tenant é esta checagem explícita (doutrina multi-tenancy).
  const { data: contact } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", input.contact_id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (!contact) {
    return fail("not_found", "Contato não encontrado nesta organização.", 404, { requestId });
  }

  if (input.conversation_id) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", input.conversation_id)
      .eq("organization_id", activeOrg.orgId)
      .maybeSingle();
    if (!conversation) {
      return fail("not_found", "Conversa não encontrada nesta organização.", 404, { requestId });
    }
  }

  if (input.lead_id) {
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("id")
      .eq("id", input.lead_id)
      .eq("organization_id", activeOrg.orgId)
      .maybeSingle();
    if (!lead) {
      return fail("not_found", "Lead não encontrado nesta organização.", 404, { requestId });
    }
  }

  const requestHash = hashInput(input);
  const idempotencyKey =
    req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");

  if (idempotencyKey) {
    const { error: reserveErr } = await supabase.from("idempotency_keys").insert({
      organization_id: activeOrg.orgId,
      endpoint: ENDPOINT_TAG,
      key: idempotencyKey,
      request_hash: requestHash,
      response_body: {},
      status_code: 0,
      expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString(),
    });

    if (reserveErr) {
      if (reserveErr.code !== "23505") {
        return fail("internal_error", reserveErr.message, 500, { requestId });
      }
      const { data: existingKey } = await supabase
        .from("idempotency_keys")
        .select("request_hash, response_body, status_code")
        .eq("organization_id", activeOrg.orgId)
        .eq("endpoint", ENDPOINT_TAG)
        .eq("key", idempotencyKey)
        .maybeSingle();

      if (!existingKey || existingKey.request_hash !== requestHash) {
        return fail(
          "idempotency_conflict",
          "Idempotency-Key já usada com payload diferente.",
          409,
          { requestId },
        );
      }
      if (existingKey.status_code === 0) {
        return fail(
          "state_conflict",
          "Requisição com esta Idempotency-Key ainda em andamento — tente novamente em instantes.",
          409,
          { requestId },
        );
      }
      return ok(existingKey.response_body as Record<string, unknown>, {
        status: 201,
        requestId,
      });
    }
  }

  const threadId = randomUUID();
  const sideEffectKey = `${WORKFLOW_TYPE}:${threadId}`;
  const initialStatus = initialStatusForMode(feature.mode);

  try {
    const { data: created, error: insErr } = await supabase
      .from("ai_workflow_runs")
      .insert({
        organization_id: activeOrg.orgId,
        workflow_type: WORKFLOW_TYPE,
        thread_id: threadId,
        contact_id: input.contact_id,
        conversation_id: input.conversation_id ?? null,
        lead_id: input.lead_id ?? null,
        status: initialStatus,
        draft_payload: {},
        side_effect_key: sideEffectKey,
        created_by: user.id,
      })
      .select(WORKFLOW_RUN_COLUMNS)
      .single();

    if (insErr || !created) {
      throw new Error(insErr?.message ?? "insert sem retorno");
    }
    const row = created as AiWorkflowRunRow;

    void audit({
      action: "workflow.created",
      actorUserId: user.id,
      organizationId: activeOrg.orgId,
      resourceType: "ai_workflow_run",
      resourceId: row.id,
      requestId,
      metadata: {
        thread_id: row.thread_id,
        workflow_type: row.workflow_type,
        status: row.status,
        feature_mode: feature.mode,
      },
    });

    const responseBody = { id: row.id, thread_id: row.thread_id, status: row.status };

    if (idempotencyKey) {
      await supabase
        .from("idempotency_keys")
        .update({ response_body: responseBody, status_code: 201 })
        .eq("organization_id", activeOrg.orgId)
        .eq("endpoint", ENDPOINT_TAG)
        .eq("key", idempotencyKey)
        .then(({ error }) => {
          if (error) {
            console.error("[workflows.create] idempotency cache write failed", error.message);
          }
        });
    }

    return ok(responseBody, { status: 201, requestId });
  } catch (err) {
    // Libera a reserva: a chave não virou criação real, então uma retentativa
    // com a MESMA key precisa poder tentar de novo, não travar em 409 pra sempre.
    if (idempotencyKey) {
      await supabase
        .from("idempotency_keys")
        .delete()
        .eq("organization_id", activeOrg.orgId)
        .eq("endpoint", ENDPOINT_TAG)
        .eq("key", idempotencyKey)
        .eq("status_code", 0)
        .then(({ error }) => {
          if (error) {
            console.error("[workflows.create] idempotency reservation cleanup failed", error.message);
          }
        });
    }
    const message = err instanceof Error ? err.message : String(err);
    return fail("internal_error", message, 500, { requestId });
  }
}

const listQuerySchema = z.object({
  status: z.string().min(1).max(30).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("manager", { requestId, resource: "ai_workflow_runs" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = listQuerySchema.safeParse(params);
  if (!parsed.success) {
    return fail("validation_failed", "Query inválida.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }
  const q = parsed.data;

  const supabase = await createClient();
  let query = supabase
    .from("ai_workflow_runs")
    .select(WORKFLOW_RUN_COLUMNS)
    .eq("organization_id", activeOrg.orgId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(q.limit + 1);

  if (q.status) query = query.eq("status", q.status);

  if (q.cursor) {
    const c = decodeWorkflowCursor(q.cursor);
    if (!c) return fail("invalid_cursor", "Cursor inválido.", 400, { requestId });
    query = query.or(
      `created_at.lt.${c.created_at},and(created_at.eq.${c.created_at},id.lt.${c.id})`,
    );
  }

  const { data, error } = await query;
  if (error) return fail("internal_error", error.message, 500, { requestId });

  const rows = (data ?? []) as AiWorkflowRunRow[];
  const hasMore = rows.length > q.limit;
  const page = hasMore ? rows.slice(0, q.limit) : rows;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeWorkflowCursor({ created_at: last.created_at, id: last.id }) : null;

  return ok(page, {
    requestId,
    meta: { cursor: nextCursor, has_more: hasMore },
  });
}
