import type {
  ChannelName,
  EngineAccountContext,
  EngineCapabilities,
  EngineHealth,
  EngineName,
  GatewayEventEnvelope,
  GatewayMediaDownloadRequest,
  GatewayMediaDownloadResult,
  GatewaySendRequest,
  GatewaySendResult,
} from "./types";

export type GatewayEventHandler = (event: GatewayEventEnvelope) => void | Promise<void>;

export interface MessagingEngine {
  readonly name: EngineName;
  readonly channel: ChannelName;
  readonly capabilities: EngineCapabilities;

  connect(context: EngineAccountContext): Promise<void>;
  disconnect(context: EngineAccountContext): Promise<void>;
  health(context?: EngineAccountContext): Promise<EngineHealth>;
  send(request: GatewaySendRequest): Promise<GatewaySendResult>;
  downloadMedia(request: GatewayMediaDownloadRequest): Promise<GatewayMediaDownloadResult>;
  ingest(event: GatewayEventEnvelope): Promise<void>;
  subscribe(handler: GatewayEventHandler): () => void;
}

export interface EngineFactoryContext {
  organizationId: string;
  accountId: string;
  sessionRef: string;
}

export type MessagingEngineFactory = (context: EngineFactoryContext) => MessagingEngine;
