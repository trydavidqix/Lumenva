/**
 * POST /api/v1/privacy/anonymize
 *
 * Irreversible cascade redact (Spec 05 §LGPD). Only `admin` role within the
 * tenant or platform_admin can execute. Idempotent: re-anonymizing returns
 * 200 with `action: "already_anonymized"`.
 *
 * Delegates the actual cascade to `cascadeRedactContact` — the SAME atomic,
 * transactional RPC (`fn_lgpd_cascade_redact_contact`) used by the
 * request-driven LGPD SLA flow (`workers/lgpd-redact-worker.ts`). This route
 * used to hand-roll a subset of the cascade (contacts + crm_leads +
 * crm_lead_activities only, non-transactional), leaving conversations,
 * messages, orders and the contact avatar fully intact with real PII while
 * still marking `is_anonymized=true` — defeating the point of an
 * "irreversible" anonymization. There must be exactly one code path that
 * defines what "anonymized" means.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/api/types";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { cascadeRedactContact } from "@/lib/lgpd/redact-cascade";
import { lgpdAnonymizeSchema, validateRequest } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return fail("unauthenticated", "Auth required.", 401, { requestId });
  }

  let input;
  try {
    input = await validateRequest(lgpdAnonymizeSchema, req);
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, {
        details: err.details as Record<string, unknown> | undefined,
        requestId,
      });
    }
    throw err;
  }

  // Fetch contact (RLS scoped).
  const { data: existing, error: selErr } = await supabase
    .from("contacts")
    .select("id, organization_id, is_anonymized, anonymized_at")
    .eq("id", input.contact_id)
    .maybeSingle();
  if (selErr) {
    return fail("internal_error", selErr.message, 500, { requestId });
  }
  if (!existing) {
    return fail("not_found", "Contato não encontrado.", 404, { requestId });
  }

  // Permission: admin NA ORG DO CONTATO (pode diferir da org ativa do cookie)
  // OR platform_admin. Org do contato vem de query RLS-scoped (fonte confiável).
  const authz = await requireRole("admin", {
    requestId,
    resource: "contact",
    allowPlatformAdmin: true,
    organizationId: existing.organization_id,
  });
  if (!authz.ok) return authz.response;

  // Idempotency.
  if (existing.is_anonymized) {
    return ok(
      {
        contact_id: existing.id,
        anonymized_at: existing.anonymized_at,
        action: "already_anonymized",
      },
      { requestId },
    );
  }

  const nowIso = new Date().toISOString();

  const cascade = await cascadeRedactContact({
    organizationId: existing.organization_id,
    contactId: existing.id,
    requestId,
  });

  if (cascade.alreadyAnonymized) {
    // Corrida: outra requisição venceu a RPC entre o SELECT acima e agora.
    // `nowIso` foi calculado ANTES da RPC rodar — não é o timestamp real da
    // anonimização, que pertence à transação vencedora. Busca o valor real
    // em vez de inventar um.
    const { data: real } = await supabase
      .from("contacts")
      .select("anonymized_at")
      .eq("id", existing.id)
      .maybeSingle();
    return ok(
      {
        contact_id: existing.id,
        anonymized_at: real?.anonymized_at ?? null,
        action: "already_anonymized",
      },
      { requestId },
    );
  }

  // Emit (best-effort; a falha aqui não desfaz a cascata, que já foi
  // aplicada de forma atômica pela RPC acima).
  await supabase
    .rpc("emit_event", {
      p_event_type: "contact.anonymized",
      p_entity_kind: "contact",
      p_entity_id: existing.id,
      p_payload: {
        contact_id: existing.id,
        actor_user_id: user.id,
        justification: input.justification,
      },
      p_metadata: { request_id: requestId },
      p_organization_id: existing.organization_id,
    })
    .then(({ error }) => {
      if (error) console.error("[lgpd.anonymize] emit_event failed", error.message);
    });

  // A RPC já grava seu próprio `lgpd.redact_executed` dentro da transação
  // (ver fn_lgpd_cascade_redact_contact); este segundo registro amarra a
  // justificativa do admin e o request desta rota especificamente ao mesmo
  // contato, com as contagens REAIS devolvidas pela cascata — não uma lista
  // estática que mentia sobre o que foi de fato redigido.
  await audit({
    action: "lgpd.anonymize_executed",
    actorUserId: user.id,
    organizationId: existing.organization_id,
    resourceType: "contact",
    resourceId: existing.id,
    requestId,
    metadata: {
      contact_id: existing.id,
      justification: input.justification,
      redacted_counts: cascade.counts,
      media_paths_enqueued: cascade.mediaPaths.length,
    },
  });

  return ok({
    contact_id: existing.id,
    anonymized_at: nowIso,
    result: cascade.result,
    irreversibility_proof: cascade.irreversibilityProof,
    message: "Dados pessoais anonimizados de forma irreversível; histórico operacional minimizado foi retido.",
  }, { requestId });
}
