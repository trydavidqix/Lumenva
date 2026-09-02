import { describe, expect, it, vi } from 'vitest';
import { createInngestRealBenchmarkInvocation } from '@/lib/agent-engine/durable-benchmark/adapters/inngest/real-runtime';

describe('Phase 7 Inngest real runtime boundary', () => {
  it('dispatches only synthetic benchmark runs through the injected Inngest client', async () => {
    const send = vi.fn().mockResolvedValue({ ids: ['evt_1'] });
    const waitForResult = vi.fn().mockResolvedValue({
      terminalState: 'completed',
      lifecycle: [],
      retryCount: 0,
      approvalRequired: false,
      approvalSatisfied: true,
      resumedFromExpectedStep: true,
      effectAttempts: 1,
      committedEffects: 1,
      recoveredAfterCrash: false,
      crossTenantViolation: false,
      durationMs: 12,
      engineVersion: 'inngest-test',
    });

    const invoke = createInngestRealBenchmarkInvocation({ send, waitForResult });
    const effectStore = { attempt: vi.fn(), commit: vi.fn(), countAttempts: vi.fn(), countCommitted: vi.fn() } as never;

    const result = await invoke({
      run: {
        runId: 'run_1',
        scenarioId: 'happy_path',
        scenarioVersion: '7.0.0',
        organizationId: 'synthetic-org-phase-7',
      },
      effectStore,
    });

    expect(send).toHaveBeenCalledWith({
      name: 'agent-os/phase-7-benchmark.run',
      data: {
        runId: 'run_1',
        scenarioId: 'happy_path',
        scenarioVersion: '7.0.0',
        organizationId: 'synthetic-org-phase-7',
      },
    });
    expect(waitForResult).toHaveBeenCalledOnce();
    expect(result.engineVersion).toBe('inngest-test');
  });

  it('fails closed for non-synthetic organizations before dispatch', async () => {
    const send = vi.fn();
    const waitForResult = vi.fn();
    const invoke = createInngestRealBenchmarkInvocation({ send, waitForResult });

    await expect(
      invoke({
        run: {
          runId: 'run_2',
          scenarioId: 'happy_path',
          scenarioVersion: '7.0.0',
          organizationId: 'real-customer-org',
        },
        effectStore: {} as never,
      }),
    ).rejects.toThrow(/synthetic/i);

    expect(send).not.toHaveBeenCalled();
    expect(waitForResult).not.toHaveBeenCalled();
  });
});
