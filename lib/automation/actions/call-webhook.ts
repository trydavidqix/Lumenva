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

const TIMEOUT_MS = 10_000;
const RETRY_DELAYS_MS = [1_000, 5_000]; // total 3 tentativas

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function executeCallWebhook(
  ctx: ActionCtx,
  config: Record<string, unknown>,
  opts: { skipUrlCheck?: boolean; retryDelaysMs?: number[] } = {},
): Promise<ActionResultDetail> {
  const url = typeof config.url === "string" ? config.url : null;
  if (!url) return { type: "call_webhook", status: "failed", error: "missing_url" };
  if (!opts.skipUrlCheck) {
    try {
      assertSafeOutboundUrl(url);
    } catch (err) {
      return { type: "call_webhook", status: "failed", error: (err as Error).message };
    }
  }

  const body = JSON.stringify({
    event: ctx.event.event_type,
    occurred_at: new Date().toISOString(),
    data: {
      ...ctx.event.payload,
      ...(ctx.context.lead ? { lead: ctx.context.lead } : {}),
      ...(ctx.context.contact ? { contact: ctx.context.contact } : {}),
    },
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Deskcomm-Event": ctx.event.event_type,
  };
  const secret = typeof config.secret === "string" ? config.secret : null;
  if (secret) {
    headers["X-Deskcomm-Signature"] = createHmac("sha256", secret).update(body).digest("hex");
  }

  const retryDelaysMs = opts.retryDelaysMs ?? RETRY_DELAYS_MS;
  let lastError = "";
  let lastStatus: number | null = null;
  for (let attempt = 1; attempt <= retryDelaysMs.length + 1; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      lastStatus = res.status;
      if (res.ok) {
        return { type: "call_webhook", status: "success", detail: { response_status: res.status, attempt } };
      }
      lastError = `http_${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    const delay = retryDelaysMs[attempt - 1];
    if (delay !== undefined) await sleep(delay);
  }
  return {
    type: "call_webhook",
    status: "failed",
    error: lastError,
    detail: { response_status: lastStatus, attempts: retryDelaysMs.length + 1 },
  };
}

registerAction({
  type: "call_webhook",
  execute: (ctx, config) => executeCallWebhook(ctx, config),
});
