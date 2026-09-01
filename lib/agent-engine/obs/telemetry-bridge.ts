import type { AiTracer } from './ai-tracing';

export interface ExternalTelemetryPayload {
  organizationId: string;
  eventId: string;
  jobId: string;
  runId: string;
  traceId: string;
  correlationId: string;
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
}

export interface ExternalTelemetryAdapter {
  publish(payload: ExternalTelemetryPayload): Promise<void>;
}

export type TelemetryBridgeResult =
  | { kind: 'published' }
  | { kind: 'degraded'; reason: 'external_telemetry_unavailable' };

export function createAiTracerTelemetryAdapter(tracer: AiTracer): ExternalTelemetryAdapter {
  return {
    async publish(payload) {
      const span = await tracer.startSpan({
        name: 'agent_os_run_telemetry',
        runId: payload.runId,
        traceId: payload.traceId,
        organizationId: payload.organizationId,
        metadata: {
          event_id: payload.eventId,
          job_id: payload.jobId,
          correlation_id: payload.correlationId,
          provider: payload.provider,
          model: payload.model,
        },
      });

      await span.end({
        metrics: {
          tokens_in: payload.tokensIn,
          tokens_out: payload.tokensOut,
          cost_usd: payload.costUsd,
          latency_ms: payload.latencyMs,
        },
      });
    },
  };
}

export async function publishTelemetryBridge(
  adapter: ExternalTelemetryAdapter,
  payload: ExternalTelemetryPayload,
): Promise<TelemetryBridgeResult> {
  try {
    await adapter.publish(payload);
    return { kind: 'published' };
  } catch {
    return { kind: 'degraded', reason: 'external_telemetry_unavailable' };
  }
}
