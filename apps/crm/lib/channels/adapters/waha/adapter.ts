import { ChannelTransportPort, ChannelTransportCommand, ChannelTransportResult, ExternalOperationContext } from "./types";
import { wahaSendPlanFor } from "@/lib/waha/media-send";
import { parseWahaMessageId } from "@/lib/waha/message-id";
import { env } from "@/lib/env";
import { verifyHmacSha512 } from "@/lib/waha/ingest";

export class WahaTransportAdapter implements ChannelTransportPort {
  private get baseUrl() {
    return env.WAHA_API_BASE_URL || null;
  }

  private get apiKey() {
    const key = env.WAHA_API_KEY;
    if (!key || key === "dev_plaintext_change_me") return null;
    return key;
  }

  async execute(ctx: ExternalOperationContext, command: ChannelTransportCommand): Promise<ChannelTransportResult> {
    if (command.type === "verify_webhook") {
      return this.verifyWebhook(command);
    }

    if (!this.baseUrl || !this.apiKey) {
      return { error: { code: "not_configured", message: "WAHA client is not configured" } };
    }

    try {
      if (command.type === "stop_session") {
        const res = await this.request(`/api/sessions/${encodeURIComponent(command.sessionRef)}/stop`, { method: "POST", body: {} });
        if (!res.ok && ![404, 422, 409].includes(res.status)) throw await this.buildError(res, "stop");
        return {};
      }
      if (command.type === "start_session") {
        const createRes = await this.request(`/api/sessions`, { method: "POST", body: { name: command.sessionRef, config: {} } });
        if (!createRes.ok && createRes.status !== 422 && createRes.status !== 409) throw await this.buildError(createRes, "create");

        const startRes = await this.request(`/api/sessions/${encodeURIComponent(command.sessionRef)}/start`, { method: "POST", body: {} });
        if (!startRes.ok && startRes.status !== 422 && startRes.status !== 409) throw await this.buildError(startRes, "start");

        if (startRes.status === 422 || startRes.status === 409) {
          const checkRes = await this.request(`/api/sessions/${encodeURIComponent(command.sessionRef)}`, { method: "GET" });
          if (!checkRes.ok) throw await this.buildError(checkRes, "get");
          const data = await checkRes.json() as any;
          return { status: data.status, qr: data.qr };
        }

        const data = await startRes.json() as any;
        return { status: data.status, qr: data.qr };
      }
      if (command.type === "logout_session") {
        const res = await this.request(`/api/sessions/${encodeURIComponent(command.sessionRef)}/logout`, { method: "POST", body: {} });
        if (!res.ok && ![404, 422, 409].includes(res.status)) throw await this.buildError(res, "logout");
        return {};
      }

      if (command.type === "send_message") {
        if (command.media) {
          const plan = wahaSendPlanFor(command.kind ?? "document", {
            url: command.media.url,
            mime: command.media.mimetype,
            filename: command.media.filename,
            caption: command.media.caption
          });

          const res = await this.request(`/api/${plan.endpoint}`, {
            method: "POST",
            body: { session: command.sessionRef, chatId: command.to, ...plan.payload }
          });
          if (!res.ok) throw await this.buildError(res, "sendMedia");
          const data = await res.json();
          return { externalId: parseWahaMessageId(data) };
        }

        const res = await this.request(`/api/sendText`, {
          method: "POST",
          body: { session: command.sessionRef, chatId: command.to, text: command.body ?? "" }
        });
        if (!res.ok) throw await this.buildError(res, "sendMessage");
        const data = await res.json();
        return { externalId: parseWahaMessageId(data) };
      }

      return { error: { code: "unknown_command", message: "Command not implemented" } };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";

      if (message.includes("23505") || (err as any)?.code === "23505") {
        return {
          externalId: ctx.idempotencyKey ?? null,
          error: undefined
        };
      }

      return { error: { code: "send_failed", message } };
    }
  }

  private async request(path: string, init: { method: string, body?: any }) {
    const headers: Record<string, string> = { "X-Api-Key": this.apiKey! };
    if (init.body) headers["Content-Type"] = "application/json";

    return fetch(`${this.baseUrl}${path}`, {
      method: init.method,
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  }

  private async buildError(res: Response, prefix: string) {
    const body = await res.text().catch(() => "");
    return new Error(`waha_${prefix}_${res.status}: ${body.slice(0, 200)}`);
  }

  private verifyWebhook(command: Extract<ChannelTransportCommand, { type: "verify_webhook" }>): ChannelTransportResult {
    const { rawBody, signatureHeader, sessionSecret } = command;

    const envSecret = (env.WAHA_HMAC_SECRET ?? "").trim();
    const secret =
      sessionSecret && sessionSecret.length >= 16
        ? sessionSecret
        : envSecret.length >= 16
          ? envSecret
          : null;

    const required = env.WAHA_WEBHOOK_REQUIRE_SIGNATURE === "true";

    if (signatureHeader) {
      if (!secret) return { isValid: false, reason: "bad_signature" };
      return verifyHmacSha512(rawBody, signatureHeader, secret)
        ? { isValid: true }
        : { isValid: false, reason: "bad_signature" };
    }

    if (required) return { isValid: false, reason: "signature_required" };
    return { isValid: true, reason: "unverified" };
  }
}
