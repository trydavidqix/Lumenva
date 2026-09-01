import { randomUUID } from 'node:crypto';

import type { Queryable } from '../queue/queue';

export interface ProviderEventSink {
  emit(event: ProviderAttemptEvent): Promise<void>;
}

export interface ProviderAttemptBase {
  organizationId: string;
  runId: string;
  traceId: string;
  correlationId: string;
}

export interface ProviderAttemptEvent extends ProviderAttemptBase {
  kind: 'provider_failure' | 'fallback_start' | 'fallback_success' | 'fallback_failure';
  attemptId: string;
  recordedAt: string;
  provider?: string;
  model?: string;
  priorAttemptId?: string;
  errorCode?: string;
}

export function createPostgresProviderEventSink(db: Queryable): ProviderEventSink {
  return {
    async emit(event) {
      await db.query(
        `insert into event_log
           (organization_id, event_type, entity_kind, entity_id, payload, metadata)
         values ($1, $2, 'agent_run', $3, $4::jsonb, $5::jsonb)`,
        [
          event.organizationId,
          `agent_os.provider.${event.kind}`,
          event.runId,
          JSON.stringify(event),
          JSON.stringify({
            run_id: event.runId,
            trace_id: event.traceId,
            correlation_id: event.correlationId,
            attempt_id: event.attemptId,
            prior_attempt_id: event.priorAttemptId ?? null,
            provider: event.provider ?? null,
            model: event.model ?? null,
          }),
        ],
      );
    },
  };
}

export function createProviderAttemptTracker(
  sink: ProviderEventSink,
  base: ProviderAttemptBase,
) {
  const emit = async (
    event: Omit<ProviderAttemptEvent, keyof ProviderAttemptBase | 'recordedAt'>,
  ): Promise<ProviderAttemptEvent> => {
    const full: ProviderAttemptEvent = {
      ...base,
      ...event,
      recordedAt: new Date().toISOString(),
    };
    await sink.emit(full);
    return full;
  };

  return {
    providerFailure(input: { provider: string; model: string; errorCode: string }) {
      return emit({
        kind: 'provider_failure',
        attemptId: randomUUID(),
        ...input,
      });
    },

    fallbackStart(input: {
      provider: string;
      model: string;
      priorAttemptId: string;
    }) {
      return emit({
        kind: 'fallback_start',
        attemptId: randomUUID(),
        ...input,
      });
    },

    fallbackSuccess(input: { attemptId: string }) {
      return emit({
        kind: 'fallback_success',
        attemptId: input.attemptId,
      });
    },

    fallbackFailure(input: { attemptId: string; errorCode: string }) {
      return emit({
        kind: 'fallback_failure',
        attemptId: input.attemptId,
        errorCode: input.errorCode,
      });
    },
  };
}
