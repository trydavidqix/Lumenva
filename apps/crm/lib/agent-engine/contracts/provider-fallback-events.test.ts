import { describe, expect, it } from 'vitest';

import {
  createProviderAttemptTracker,
  type ProviderEventSink,
} from '../obs/provider-events';

function memorySink(): ProviderEventSink & { read: () => unknown[] } {
  const events: unknown[] = [];
  return {
    async emit(event) {
      events.push(event);
    },
    read: () => events,
  };
}

describe('Agent OS provider fallback observability', () => {
  it('provider failure e fallback start/success ficam separados e correlacionados', async () => {
    const sink = memorySink();
    const tracker = createProviderAttemptTracker(sink, {
      organizationId: 'org-1',
      runId: 'run-1',
      traceId: 'trace-1',
      correlationId: 'corr-1',
    });

    const failedAttempt = await tracker.providerFailure({
      provider: 'openai',
      model: 'gpt-a',
      errorCode: 'timeout',
    });
    const fallbackAttempt = await tracker.fallbackStart({
      provider: 'anthropic',
      model: 'claude-b',
      priorAttemptId: failedAttempt.attemptId,
    });
    await tracker.fallbackSuccess({ attemptId: fallbackAttempt.attemptId });

    expect(sink.read()).toEqual([
      expect.objectContaining({ kind: 'provider_failure', attemptId: failedAttempt.attemptId }),
      expect.objectContaining({
        kind: 'fallback_start',
        attemptId: fallbackAttempt.attemptId,
        priorAttemptId: failedAttempt.attemptId,
      }),
      expect.objectContaining({
        kind: 'fallback_success',
        attemptId: fallbackAttempt.attemptId,
      }),
    ]);
    expect((sink.read() as Array<Record<string, unknown>>).every((event) => event.runId === 'run-1')).toBe(true);
  });

  it('fallback failure também é explícita e ligada ao mesmo attempt', async () => {
    const sink = memorySink();
    const tracker = createProviderAttemptTracker(sink, {
      organizationId: 'org-1',
      runId: 'run-2',
      traceId: 'trace-2',
      correlationId: 'corr-2',
    });

    const fallback = await tracker.fallbackStart({
      provider: 'openai',
      model: 'gpt-b',
      priorAttemptId: 'attempt-previous',
    });
    await tracker.fallbackFailure({ attemptId: fallback.attemptId, errorCode: 'rate_limit' });

    expect(sink.read().at(-1)).toMatchObject({
      kind: 'fallback_failure',
      attemptId: fallback.attemptId,
      errorCode: 'rate_limit',
    });
  });
});
