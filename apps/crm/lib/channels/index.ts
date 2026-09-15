/**
 * A porta de entrada do seam. Feature nenhuma importa `lib/waha/*` direto —
 * pede o adapter do provider da conversa e o descritor de capabilities.
 */
import { metaCloudAdapter } from "./adapters/meta-cloud";
import { wahaAdapter } from "./adapters/waha";
import type { ChannelAdapter, ChannelProvider } from "./types";

export { assertChannelConsent, hasChannelConsent } from "./gateway/consent";

const ADAPTERS: Record<ChannelProvider, ChannelAdapter | null> = {
  waha: wahaAdapter,
  meta_cloud: metaCloudAdapter,
};

/**
 * Fail-closed: provider sem adapter (ou fora da matriz) lança em vez de cair no
 * WAHA por default. Enviar pelo canal errado é pior que não enviar.
 */

export function getAdapter(provider: ChannelProvider): ChannelAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`unknown_channel_provider: ${provider}`);
  return adapter;
}

export { capabilitiesOf, CHANNEL_CAPABILITIES, DEFAULT_CHANNEL_PROVIDER } from "./capabilities";
export { createMetaCloudEngine } from "./engines/meta-cloud-engine";
export type { MetaCloudEngineConfig } from "./engines/meta-cloud-engine";
export { createWahaEngine } from "./engines/waha-engine";
export type { WahaEngineConfig } from "./engines/waha-engine";
export { hasCapability } from "./gateway/capabilities";
export { DuplicateEngineRegistrationError, UnknownEngineError } from "./gateway/errors";
export {
  normalizeExternalIdentity,
  resolveCustomerIdentity,
} from "./gateway/identity-resolver";
export type {
  ExternalIdentity,
  IdentityLookup,
  IdentityMatch,
  IdentityRepository,
  IdentityResolution,
} from "./gateway/identity-resolver";
export { EngineRegistry } from "./gateway/registry";
export {
  REDACTED,
  assertGatewayTenantScope,
  authorizeGatewayToolCall,
  markExternalContentUntrusted,
  sanitizeGatewayLogContext,
  sanitizeGatewayLogValue,
} from "./gateway/security";
export type {
  AuthoritySource,
  ToolAuthorizationDecision,
  ToolRisk,
  UntrustedExternalContent,
} from "./gateway/security";
export {
  assertNoAutomaticEngineMigration,
  chooseRecoveryAction,
  classifySessionHealth,
  DEFAULT_SESSION_HEALTH_POLICY,
  sessionLeaseKey,
} from "./gateway/session-supervisor";
export type {
  RecoveryAction,
  SessionAuthState,
  SessionHealth,
  SessionHealthPolicy,
  SessionHealthResult,
  SessionHealthSignals,
  SessionLeaseScope,
  SessionLeaseStore,
} from "./gateway/session-supervisor";
export {
  assertTraceContinuity,
  createGatewayTrace,
  traceEvent,
} from "./gateway/trace";
export type {
  GatewayTraceContext,
  GatewayTraceEvent,
  GatewayTraceStage,
} from "./gateway/trace";
export { CHANNEL_SESSION_REF_COLUMNS, resolveSessionRef } from "./session-ref";
export type {
  EngineFactoryContext,
  GatewayEventHandler,
  MessagingEngine,
  MessagingEngineFactory,
} from "./gateway/engine";
export type {
  ChannelCapability,
  ChannelName,
  EngineAccountContext,
  EngineCapabilities,
  EngineHealth,
  EngineHealthState,
  EngineName,
  GatewayContentType,
  GatewayEventEnvelope,
  GatewayEventType,
  GatewayMediaDownloadRequest,
  GatewayMediaDownloadResult,
  GatewayMediaRef,
  GatewayNormalizedContent,
  GatewaySendRequest,
  GatewaySendResult,
} from "./gateway/types";
export type { ChannelSessionRef } from "./session-ref";
export type {
  ChannelAdapter,
  ChannelCapabilities,
  ChannelProvider,
  OutboundEnvelope,
  OutboundKind,
  OutboundMedia,
  RecipientInput,
} from "./types";
