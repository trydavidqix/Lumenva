import { randomUUID } from "node:crypto";

export type GatewayTraceStage =
  | "received"
  | "identity"
  | "memory"
  | "agent"
  | "tool"
  | "outbox"
  | "delivery";

export interface GatewayTraceContext {
  traceId: string;
  organizationId: string;
  accountId: string;
  conversationId: string;
}

export interface GatewayTraceEvent extends GatewayTraceContext {
  stage: GatewayTraceStage;
  occurredAt: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export function createGatewayTrace(input: Omit<GatewayTraceContext, "traceId"> & { traceId?: string }): GatewayTraceContext {
  return {
    traceId: input.traceId?.trim() || randomUUID(),
    organizationId: input.organizationId,
    accountId: input.accountId,
    conversationId: input.conversationId,
  };
}

export function traceEvent(
  context: GatewayTraceContext,
  stage: GatewayTraceStage,
  options: {
    occurredAt?: string;
    metadata?: Readonly<Record<string, unknown>>;
  } = {},
): GatewayTraceEvent {
  return {
    ...context,
    stage,
    occurredAt: options.occurredAt ?? new Date().toISOString(),
    ...(options.metadata ? { metadata: options.metadata } : {}),
  };
}

export function assertTraceContinuity(expectedTraceId: string, actualTraceId: string): void {
  if (!expectedTraceId || expectedTraceId !== actualTraceId) {
    throw new Error("gateway_trace_mismatch");
  }
}
