/**
 * Ação `call_webhook` — POST outbound com envelope {event, occurred_at, data},
 * assinatura HMAC-sha256 opcional (config.secret) e retry 3x (1s/5s) em
 * falha de rede ou status não-2xx. Anti-SSRF via assertSafeOutboundUrl antes
 * de qualquer fetch (pulável só via opts.skipUrlCheck, usado nos testes).
 */
import { createHmac } from "node:crypto";
import { registerAction } from "@/lib/automation/actions";
import type { ActionCtx, ActionResultDetail } from "@/lib/automation/types";
import { assertSafeOutboundUrl } from "@/lib/automation/outbound-url";
import { decryptWebhookSecret } from "@/lib/webhooks/secrets";

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 5_000]; // total 3 tentativas

// Projeções públicas do envelope — NUNCA repassar a row inteira do DB (vaza
// organization_id, cpf_*, consent, source_metadata, owner_user_id etc. pra
// endpoint externo do tenant). Só inclui as chaves presentes na row.
const LEAD_PUBLIC_FIELDS = [
  "id",
  "title",
  "status",
  "pipeline_id",
  "stage_id",
  "value_cents",
  "currency",
  "tags",
  "custom_fields",
  "source",
  "created_at",
] as const;

const CONTACT_PUBLIC_FIELDS = [
  "id",
  "name",
  "display_name",
  "email",
  "phone_number",
  "tags",
  "created_at",
] as const;

function projectPublicFields(
  row: unknown,
  fields: readonly string[],
): Record<string, unknown> | undefined {
  if (!row || typeof row !== "object") return undefined;
  const source = row as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of fields) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface WebhookDeliveryResult {
  status: "success" | "failed";
  error?: string;
  detail?: Record<string, unknown>;
}

export interface DeliverSignedWebhookOpts {
  /** Pulável só nos testes — todo caller de produção passa pelo guard. */
  skipUrlCheck?: boolean;
  retryDelaysMs?: number[];
  /** HMAC-sha256 do body; durante 90 dias emitimos os headers novo e legado. */
  secret?: string | null;
  /** Headers extras do caller (ex.: X-Deskcomm-Event). Nunca inclui a assinatura — essa é sempre computada aqui. */
  headers?: Record<string, string>;
}

/**
 * Transporte outbound canônico — ÚNICO lugar do repo que faz fetch() de
 * webhook de tenant. Cobre assertSafeOutboundUrl, assinatura HMAC-sha256
 * (X-Lumenva-Signature + X-Deskcomm-Signature) e o loop de retry/timeout/redirect:"manual".
 *
 * Compartilhado por `call_webhook` (abaixo) e `n8n_webhook`
 * (lib/automation/actions/n8n-webhook.ts) — nenhuma das duas ações
 * reimplementa fetch/anti-SSRF/HMAC; ambas chamam esta função.
 */
export async function deliverSignedWebhook(
  url: string,
  body: string,
  opts: DeliverSignedWebhookOpts = {},
): Promise<WebhookDeliveryResult> {
  if (!opts.skipUrlCheck) {
    try {
      assertSafeOutboundUrl(url);
    } catch (err) {
      return { status: "failed", error: (err as Error).message };
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers ?? {}),
  };
  if (opts.secret) {
    const signature = createHmac("sha256", opts.secret).update(body).digest("hex");
    headers["X-Lumenva-Signature"] = signature;
    headers["X-Deskcomm-Signature"] = signature;
  }

  const retryDelaysMs = opts.retryDelaysMs ?? RETRY_DELAYS_MS;
  let lastError = "";
  let lastStatus: number | null = null;
  for (let attempt = 1; attempt <= retryDelaysMs.length + 1; attempt++) {
    try {
      // redirect: "manual" — nunca seguir 3xx automaticamente. fetch por padrão
      // segue redirect, e uma URL de tenant que passou no guard anti-SSRF pode
      // 302 pra um endpoint interno (ex.: http://169.254.169.254/...). Um 3xx
      // vira falha comum (conta pro retry), nunca é seguido.
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      lastStatus = res.status;
      if (res.ok) {
        return { status: "success", detail: { response_status: res.status, attempt } };
      }
      lastError = res.status >= 300 && res.status < 400 ? "redirect_not_followed" : `http_${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    const delay = retryDelaysMs[attempt - 1];
    if (delay !== undefined) await sleep(delay);
  }
  return {
    status: "failed",
    error: lastError,
    detail: { response_status: lastStatus, attempts: retryDelaysMs.length + 1 },
  };
}

export async function executeCallWebhook(
  ctx: ActionCtx,
  config: Record<string, unknown>,
  opts: { skipUrlCheck?: boolean; retryDelaysMs?: number[] } = {},
): Promise<ActionResultDetail> {
  const url = typeof config.url === "string" ? config.url : null;
  if (!url) return { type: "call_webhook", status: "failed", error: "missing_url" };
  // opts.skipUrlCheck exists ONLY so tests can hit local/loopback listeners
  // without tripping assertSafeOutboundUrl's anti-SSRF guard. No production
  // caller of executeCallWebhook passes it. NODE_ENV gate is a second,
  // independent floor under that convention — a caller that accidentally
  // sets skipUrlCheck outside a test run still gets the guard.
  const TEST_ONLY_SKIP_URL_CHECK = process.env.NODE_ENV === "test" && opts.skipUrlCheck === true;
  if (!TEST_ONLY_SKIP_URL_CHECK) {
    try {
      assertSafeOutboundUrl(url);
    } catch (err) {
      return { type: "call_webhook", status: "failed", error: (err as Error).message };
    }
  }

  const leadPublic = projectPublicFields(ctx.context.lead, LEAD_PUBLIC_FIELDS);
  const contactPublic = projectPublicFields(ctx.context.contact, CONTACT_PUBLIC_FIELDS);
  const body = JSON.stringify({
    event: ctx.event.event_type,
    occurred_at: new Date().toISOString(),
    data: {
      ...ctx.event.payload,
      ...(leadPublic ? { lead: leadPublic } : {}),
      ...(contactPublic ? { contact: contactPublic } : {}),
    },
  });
  // secret_enc (cifrado at-rest, migration 0041) tem precedência; config.secret
  // plaintext fica só como legado pré-retrofit. Decrypt indisponível (chave da
  // GUC ausente) → envia SEM assinatura em vez de falhar a entrega — espelho do
  // hmacSkipped do inbound.
  let secret: string | null = typeof config.secret === "string" && config.secret ? config.secret : null;
  if (typeof config.secret_enc === "string" && config.secret_enc) {
    secret = await decryptWebhookSecret(ctx.admin, config.secret_enc);
  }

  // URL já validada acima (ou skipUrlCheck explícito do caller) — não repete o guard.
  const result = await deliverSignedWebhook(url, body, {
    skipUrlCheck: true,
    retryDelaysMs: opts.retryDelaysMs,
    secret,
    headers: { "X-Lumenva-Event": ctx.event.event_type, "X-Deskcomm-Event": ctx.event.event_type },
  });
  return { type: "call_webhook", ...result };
}

registerAction({
  type: "call_webhook",
  execute: (ctx, config) => executeCallWebhook(ctx, config),
});
