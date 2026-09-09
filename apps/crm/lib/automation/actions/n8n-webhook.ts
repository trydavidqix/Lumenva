/**
 * Ação `n8n_webhook` — wrapper fino sobre o transporte outbound canônico
 * (deliverSignedWebhook, extraído de call-webhook.ts). Constrói o
 * N8nIntegrationEnvelope canônico (lib/automation/n8n/envelope.ts, Task 2)
 * em vez da projeção lead/contact específica de `call_webhook`, e delega
 * fetch/anti-SSRF/HMAC/retry inteiramente ao transporte compartilhado — não
 * existe uma segunda implementação de fetch/backoff/assinatura aqui.
 *
 * Desvio aprovado pelo dono humano do repo em relação ao schema literal do
 * brief da Task 3 (que mostrava só `secret: z.string().min(16)` plaintext):
 * `n8nWebhookConfigSchema` aceita `secret` (plaintext, legado) E
 * `secret_enc` (cifrado at-rest, migration 0041), com a MESMA precedência de
 * call-webhook.ts — secret_enc decifrado vence; decrypt indisponível (chave
 * da GUC ausente) → envia sem assinatura em vez de falhar a entrega. Ver
 * .superpowers/sdd/2026-08-10-ai-platform-phase-6-n8n/task-3-brief.md.
 */
import { z } from "zod";
import { registerAction } from "@/lib/automation/actions";
import type { ActionCtx, ActionResultDetail } from "@/lib/automation/types";
import { deliverSignedWebhook } from "@/lib/automation/actions/call-webhook";
import { decryptWebhookSecret } from "@/lib/webhooks/secrets";
import { buildN8nEnvelope } from "@/lib/automation/n8n/envelope";
import { resolveAiPlatformFeature } from "@/lib/agent-engine/platform/features";

export const n8nWebhookConfigSchema = z.strictObject({
  url: z.string().url(),
  // Input do usuário (plaintext, legado pré-retrofit) — mesma régua de call_webhook.
  secret: z.string().min(16).optional(),
  // Ciphertext hex (migration 0041) — precedência sobre secret plaintext.
  secret_enc: z.string().optional(),
  workflow_key: z.string().min(1).max(120),
});

export async function executeN8nWebhook(
  ctx: ActionCtx,
  config: Record<string, unknown>,
  opts: { skipUrlCheck?: boolean; retryDelaysMs?: number[] } = {},
): Promise<ActionResultDetail> {
  // Gate: n8n é feature AI Platform Fase 6 (default off). Kill switch ou modo
  // "off" bloqueia a entrega antes de qualquer fetch/decrypt — mesmo padrão de
  // lib/agent-engine/obs/external-tracing-config.ts (feature.killed || mode === "off").
  const n8nFeature = await resolveAiPlatformFeature({ organizationId: ctx.organizationId, feature: "n8n" });
  if (n8nFeature.mode === "off" || n8nFeature.killed) {
    return {
      type: "n8n_webhook",
      status: "failed" as const,
      error: "n8n_feature_disabled" as const,
    };
  }

  const parsed = n8nWebhookConfigSchema.safeParse(config);
  if (!parsed.success) {
    return { type: "n8n_webhook", status: "failed", error: "invalid_config" };
  }
  const { url, workflow_key, secret: plainSecret, secret_enc } = parsed.data;

  // Mesma precedência de call-webhook.ts: secret_enc decifrado sobrescreve o
  // plaintext incondicionalmente (mesmo quando o decrypt falha e retorna
  // null) — espelha o hmacSkipped do inbound em vez de falhar a entrega.
  let secret: string | null = plainSecret ?? null;
  if (secret_enc) {
    secret = await decryptWebhookSecret(ctx.admin, secret_enc);
  }

  let envelope;
  try {
    envelope = buildN8nEnvelope({
      eventId: ctx.event.id,
      eventType: ctx.event.event_type,
      occurredAt: new Date().toISOString(),
      organizationId: ctx.organizationId,
      // Determinístico a partir de (rule, event) — reprocessar o mesmo evento
      // pela mesma regra nunca inventa uma key nova (dedupe do lado n8n).
      idempotencyKey: `${ctx.ruleId}:${ctx.event.id}`,
      data: { ...ctx.event.payload, workflow_key },
    });
  } catch (err) {
    return { type: "n8n_webhook", status: "failed", error: (err as Error).message };
  }

  const body = JSON.stringify(envelope);
  const result = await deliverSignedWebhook(url, body, {
    skipUrlCheck: opts.skipUrlCheck,
    retryDelaysMs: opts.retryDelaysMs,
    secret,
  });
  return { type: "n8n_webhook", ...result };
}

registerAction({
  type: "n8n_webhook",
  execute: (ctx, config) => executeN8nWebhook(ctx, config),
});
