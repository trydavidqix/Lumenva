import { describe, expect, it, vi } from 'vitest';

import {
  publishTelemetryBridge,
  type ExternalTelemetryAdapter,
} from '../obs/telemetry-bridge';

describe('Agent OS telemetry bridge', () => {
  it('mantém IDs internos como source of truth e os envia ao telemetry externo', async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const adapter: ExternalTelemetryAdapter = { publish };

    const result = await publishTelemetryBridge(adapter, {
      organizationId: 'org-1',
      eventId: 'evt-1',
      jobId: 'job-1',
      runId: 'run-1',
      traceId: 'trace-1',
      correlationId: 'corr-1',
      provider: 'openai',
      model: 'gpt-test',
      tokensIn: 100,
      tokensOut: 20,
      costUsd: 0.01,
      latencyMs: 500,
    });

    expect(result).toEqual({ kind: 'published' });
    expect(publish).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-1',
      traceId: 'trace-1',
      correlationId: 'corr-1',
    }));
  });

  it('telemetry externo indisponível degrada sem quebrar o run interno', async () => {
    const adapter: ExternalTelemetryAdapter = {
      publish: vi.fn().mockRejectedValue(new Error('telemetry_down')),
    };

    const result = await publishTelemetryBridge(adapter, {
      organizationId: 'org-1',
      eventId: 'evt-2',
      jobId: 'job-2',
      runId: 'run-2',
      traceId: 'trace-2',
      correlationId: 'corr-2',
      provider: 'anthropic',
      model: 'claude-test',
      tokensIn: 50,
      tokensOut: 10,
      costUsd: 0.02,
      latencyMs: 700,
    });

    expect(result).toEqual({ kind: 'degraded', reason: 'external_telemetry_unavailable' });
  });
});
