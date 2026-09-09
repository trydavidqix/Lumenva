import { metaCloudAdapter } from "../adapters/meta-cloud";
import type { ChannelAdapter, OutboundEnvelope, OutboundKind } from "../types";
import type {
  EngineFactoryContext,
  GatewayEventHandler,
  MessagingEngine,
} from "../gateway/engine";
import type {
  ChannelCapability,
  GatewayEventEnvelope,
  GatewayMediaDownloadRequest,
  GatewayMediaDownloadResult,
  GatewayNormalizedContent,
  GatewaySendRequest,
} from "../gateway/types";

type Clock = () => string;
type MediaDownloader = (
  request: GatewayMediaDownloadRequest,
) => Promise<GatewayMediaDownloadResult>;

export interface MetaCloudEngineConfig {
  context: EngineFactoryContext;
  adapter?: ChannelAdapter;
  now?: Clock;
  downloadMedia?: MediaDownloader;
}

const META_CLOUD_CAPABILITIES = new Set<ChannelCapability>([
  "text",
  "image",
  "video",
  "audio",
  "document",
]);

function toOutboundEnvelope(
  sessionRef: string,
  request: GatewaySendRequest,
): OutboundEnvelope {
  const content = request.content;
  const kind = toOutboundKind(content);
  const envelope: OutboundEnvelope = {
    sessionRef,
    to: request.recipient,
    kind,
    body: content.text,
  };

  if (content.media) {
    if (!content.media.url || !content.media.mimeType) {
      throw new Error("gateway_media_requires_url_and_mime_type");
    }
    envelope.media = {
      url: content.media.url,
      mime: content.media.mimeType,
      filename: content.media.fileName ?? null,
      caption: content.text ?? null,
    };
  }

  return envelope;
}

function toOutboundKind(content: GatewayNormalizedContent): OutboundKind {
  switch (content.type) {
    case "text":
    case "image":
    case "video":
    case "audio":
    case "document":
      return content.type;
    default:
      throw new Error(`unsupported_gateway_content: ${content.type}`);
  }
}

export function createMetaCloudEngine(config: MetaCloudEngineConfig): MessagingEngine {
  const adapter = config.adapter ?? metaCloudAdapter;
  const now = config.now ?? (() => new Date().toISOString());
  const subscribers = new Set<GatewayEventHandler>();

  return {
    name: "meta_cloud",
    channel: "whatsapp",
    capabilities: META_CLOUD_CAPABILITIES,

    async connect() {
      // Cloud API account lifecycle remains in the existing control plane during migration.
    },

    async disconnect() {
      // See connect(): this wrapper preserves current lifecycle behavior.
    },

    async health() {
      return adapter.isConfigured()
        ? { state: "up", checkedAt: now() }
        : { state: "down", checkedAt: now(), reason: "not_configured" };
    },

    async send(request) {
      const result = await adapter.send(toOutboundEnvelope(config.context.sessionRef, request));
      return { externalMessageId: result.externalId };
    },

    async downloadMedia(request) {
      if (!config.downloadMedia) throw new Error("media_download_not_supported");
      return config.downloadMedia(request);
    },

    async ingest(event: GatewayEventEnvelope) {
      for (const handler of subscribers) await handler(event);
    },

    subscribe(handler) {
      subscribers.add(handler);
      return () => subscribers.delete(handler);
    },
  };
}
