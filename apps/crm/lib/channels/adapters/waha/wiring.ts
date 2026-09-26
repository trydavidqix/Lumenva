import type { ChannelAdapter, OutboundEnvelope } from "../../types";
import { WahaTransportAdapter } from "./adapter";
import { getWahaClient } from "@/lib/waha/client";
import { wahaSendPlanFor } from "@/lib/waha/media-send";
import { bareWaMessageId, parseWahaMessageId } from "@/lib/waha/message-id";
import { resolveWahaChatId } from "@/lib/waha/send";
import { randomUUID } from "node:crypto";

export const wahaTransportAdapter = new WahaTransportAdapter();

export function createWahaF7Adapter(): ChannelAdapter {
  return {
    provider: "waha",

    resolveRecipient(input): string | null {
      return resolveWahaChatId(input);
    },

    echoExternalIds(input): string[] {
      const bare = bareWaMessageId(input.externalId);
      return [...new Set([input.externalId, bare, `true_${input.recipient}_${bare}`])];
    },

    isConfigured(): boolean {
      return getWahaClient() !== null;
    },

    codes: {
      notConfigured: "waha_not_configured",
      sendFailed: "waha_error",
      unknownError: "waha_unknown",
    },

    async fetchProfilePictureUrl(input): Promise<string | null> {
      const client = getWahaClient();
      if (!client) return null;
      return client.getProfilePictureUrl(input.sessionRef, input.recipient);
    },

    async send(envelope: OutboundEnvelope): Promise<{ externalId: string | null }> {
      const isF7 = process.env.F7_WAHA_ADAPTER === "true" || process.env.F7_WAHA_ADAPTER === "1";
      if (!isF7) {
        const client = getWahaClient();
        if (!client) return { externalId: null };

        const res = envelope.media
          ? await client.sendMedia(
              envelope.sessionRef,
              envelope.to,
              wahaSendPlanFor(envelope.kind, envelope.media),
            )
          : await client.sendMessage(envelope.sessionRef, envelope.to, envelope.body ?? "");

        return { externalId: parseWahaMessageId(res) };
      }

      const extendedEnvelope = envelope as unknown as Record<string, unknown>;

      const ctx = {
        organizationId: "f7-adapter-org-fallback",
        requestId: "f7-req-" + Date.now(),
        idempotencyKey: typeof extendedEnvelope.idempotencyKey === "string" ? extendedEnvelope.idempotencyKey : randomUUID()
      };

      const result = await wahaTransportAdapter.execute(ctx, {
        type: "send_message",
        sessionRef: envelope.sessionRef,
        to: envelope.to,
        kind: envelope.kind,
        body: envelope.body,
        media: envelope.media ? {
          url: envelope.media.url,
          mimetype: envelope.media.mime,
          filename: envelope.media.filename ?? undefined,
          caption: envelope.media.caption ?? undefined,
        } : undefined
      });

      if (result.error) {
        throw new Error(`WahaTransport error: ${result.error.code} - ${result.error.message}`);
      }

      return { externalId: result.externalId ?? null };
    },
  };
}
