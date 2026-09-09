/**
 * POST /api/v1/automation-rules/runs/[runId]/resend — reexecuta SÓ as ações
 * `call_webhook` da regra do run, contra o evento original (`event_log` do
 * run.event_id). Se o evento foi apagado (FK on delete set null zera
 * event_id) → 409 `event_gone`. Grava um run NOVO com o resultado.
 *
 * Honra `Idempotency-Key` (TTL 24h): `call_webhook` é HTTP de verdade contra
 * um endpoint do tenant — um duplo-clique ou retry de cliente reenviaria o
 * MESMO payload ao webhook externo. Reserva atômica (INSERT antes de agir),
 * mesmo padrão de `/api/v1/messages`.
 */
import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildContext } from "@/lib/automation/engine";
import { executeCallWebhook } from "@/lib/automation/actions/call-webhook";
import type { ActionCtx, ActionResultDetail } from "@/lib/automation/types";
import type { EventRow } from "@/lib/event-log/dispatcher";

export const dynamic = "force-dynamic";

const ENDPOINT_TAG = "/api/v1/automation-rules/runs/resend";
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

interface RouteCtx {
  params: Promise<{ runId: string }>;
}

interface RuleAction {
  type: string;
  config?: Record<string, unknown>;
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { runId } = await ctx.params;
  const authz = await requireRole("manager", { requestId, resource: "automation_rules" });
  if (!authz.ok) return authz.response;
  const { user, org: activeOrg } = authz;

  const supabase = await createClient();

  const idempotencyKey =
    req.headers.get("Idempotency-Key") ?? req.headers.get("idempotency-key");
  const requestHash = createHash("sha256").update(runId).digest("hex");

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
          "Reenvio com esta Idempotency-Key ainda em andamento — tente novamente em instantes.",
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

  // Libera a reserva antes de devolver erro: um "não achado"/"evento sumiu"
  // não é o envio real acontecendo — travar a key por 24h numa resposta de
  // erro impediria até uma retentativa legítima com o MESMO Idempotency-Key.
  async function releaseReservation(): Promise<void> {
    if (!idempotencyKey) return;
    await supabase
      .from("idempotency_keys")
      .delete()
      .eq("organization_id", activeOrg.orgId)
      .eq("endpoint", ENDPOINT_TAG)
      .eq("key", idempotencyKey)
      .eq("status_code", 0)
      .then(({ error }) => {
        if (error) {
          console.error("[automation.resend] idempotency reservation cleanup failed", error.message);
        }
      });
  }

  const { data: run, error: runErr } = await supabase
    .from("automation_rule_runs")
    .select("id, rule_id, event_id")
    .eq("id", runId)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (runErr) {
    await releaseReservation();
    return fail("internal_error", runErr.message, 500, { requestId });
  }
  if (!run) {
    await releaseReservation();
    return fail("not_found", "Run não encontrado.", 404, { requestId });
  }

  if (!run.event_id) {
    await releaseReservation();
    return fail("event_gone", "O evento original deste run foi removido.", 409, { requestId });
  }

  const { data: rule, error: ruleErr } = await supabase
    .from("automation_rules")
    .select("id, actions")
    .eq("id", run.rule_id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (ruleErr) {
    await releaseReservation();
    return fail("internal_error", ruleErr.message, 500, { requestId });
  }
  if (!rule) {
    await releaseReservation();
    return fail("not_found", "Regra do run não encontrada.", 404, { requestId });
  }

  const { data: eventRow, error: eventErr } = await supabase
    .from("event_log")
    .select("*")
    .eq("id", run.event_id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();
  if (eventErr) {
    await releaseReservation();
    return fail("internal_error", eventErr.message, 500, { requestId });
  }
  if (!eventRow) {
    await releaseReservation();
    return fail("event_gone", "O evento original deste run foi removido.", 409, { requestId });
  }

  const typedEvent = eventRow as unknown as EventRow;
  const context = await buildContext(supabase, typedEvent);

  const callWebhookActions = ((rule.actions ?? []) as RuleAction[]).filter(
    (action) => action.type === "call_webhook",
  );

  // Admin real no ctx: o executor decifra config.secret_enc via RPC
  // fn_decrypt_oauth (grant só service_role) — client de sessão falharia e o
  // outbound sairia sem assinatura silenciosamente.
  const adminForActions = createAdminClient();
  const results: ActionResultDetail[] = [];
  for (const action of callWebhookActions) {
    const actionCtx: ActionCtx = {
      admin: adminForActions,
      organizationId: activeOrg.orgId,
      ruleId: rule.id,
      event: typedEvent,
      context,
      requestId,
    };
    results.push(await executeCallWebhook(actionCtx, action.config ?? {}));
  }

  const failed = results.filter((r) => r.status === "failed").length;
  const status = failed === 0 ? "success" : failed === results.length ? "failed" : "partial";

  // RLS: automation_rule_runs é select-only p/ authenticated (escrita é do
  // service_role, como no engine). Org vem do authz — nunca do body.
  const admin = createAdminClient();
  const { data: newRun, error: insErr } = await admin
    .from("automation_rule_runs")
    .insert({
      organization_id: activeOrg.orgId,
      rule_id: rule.id,
      event_id: typedEvent.id,
      status,
      actions_result: results,
    })
    .select("*")
    .single();
  if (insErr || !newRun) {
    await releaseReservation();
    return fail("internal_error", insErr?.message ?? "run_insert_failed", 500, { requestId });
  }

  void audit({
    action: "automation.run_resent",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "automation_rule_run",
    resourceId: newRun.id,
    requestId,
    metadata: { original_run_id: runId, rule_id: rule.id },
  });

  if (idempotencyKey) {
    await supabase
      .from("idempotency_keys")
      .update({ response_body: newRun, status_code: 201 })
      .eq("organization_id", activeOrg.orgId)
      .eq("endpoint", ENDPOINT_TAG)
      .eq("key", idempotencyKey)
      .then(({ error }) => {
        if (error) {
          console.error("[automation.resend] idempotency cache write failed", error.message);
        }
      });
  }

  return ok(newRun, { requestId, status: 201 });
}
