export type ChannelName = "whatsapp" | "instagram" | "messenger";

export type EngineName = "waha" | "meta_cloud" | "baileys" | "browser";

export type ChannelCapability =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "reaction"
  | "groups"
  | "presence"
  | "templates"
  | "profile_picture"
  | "media_download";

export type EngineCapabilities = ReadonlySet<ChannelCapability>;

export type GatewayEventType =
  | "account.connected"
  | "account.disconnected"
  | "account.degraded"
  | "message.received"
  | "message.sent"
  | "message.delivered"
  | "message.read"
  | "message.failed"
  | "media.received"
  | "conversation.created"
  | "conversation.updated"
  | "customer.typing"
  | "customer.presence_changed";

export type GatewayContentType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "reaction"
  | "location"
  | "contact"
  | "unknown";

export interface GatewayMediaRef {
  mediaId?: string;
  externalMediaId?: string;
  url?: string;
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
  sha256?: string;
}

export interface GatewayNormalizedContent {
  type: GatewayContentType;
  text?: string;
  media?: GatewayMediaRef;
  reaction?: { emoji: string; targetExternalMessageId: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  contact?: { name?: string; phoneNumber?: string };
}

export interface GatewayEventEnvelope {
  eventId: string;
  eventType: GatewayEventType;
  organizationId: string;
  channel: ChannelName;
  accountId: string;
  conversationId: string;
  customerId?: string;
  externalMessageId?: string;
  occurredAt: string;
  traceId: string;
  content: GatewayNormalizedContent;
  /** Provider-specific detail for diagnostics only. Domain logic must not depend on it. */
  diagnostic?: Readonly<Record<string, unknown>>;
}

export interface EngineAccountContext {
  organizationId: string;
  accountId: string;
  sessionRef: string;
}

export type EngineHealthState = "up" | "degraded" | "down";

export interface EngineHealth {
  state: EngineHealthState;
  checkedAt: string;
  reason?: string;
  latencyMs?: number;
}

export interface GatewaySendRequest {
  organizationId: string;
  accountId: string;
  conversationId: string;
  traceId: string;
  recipient: string;
  content: GatewayNormalizedContent;
  idempotencyKey?: string;
}

export interface GatewaySendResult {
  externalMessageId: string | null;
}

export interface GatewayMediaDownloadRequest {
  organizationId: string;
  accountId: string;
  traceId: string;
  externalMediaId: string;
}

export interface GatewayMediaDownloadResult {
  bytes: Uint8Array;
  mimeType: string;
  fileName?: string;
}
