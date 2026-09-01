import { describe, expect, it, vi } from 'vitest';

import {
  runProviderCertification,
  type ProviderCertificationStore,
} from '../models/provider-certification';

function memoryStore(): ProviderCertificationStore & { read: () => unknown[] } {
  const rows: unknown[] = [];
  return {
    async save(record) {
      rows.push(record);
    },
    read: () => rows,
  };
}

describe('Agent OS provider certification harness', () => {
  it('executa a sequência determinística e persiste evidência CERTIFIED sem tool destrutiva', async () => {
    const store = memoryStore();
    const destructiveTool = vi.fn();
    const steps: string[] = [];

    const result = await runProviderCertification({
      provider: 'openai',
      model: 'gpt-test',
      store,
      adapter: {
        async connection() { steps.push('connection'); return true; },
        async structuredOutput() { steps.push('structured_output'); return true; },
        async toolCalling() { steps.push('tool_calling'); return true; },
        async toolFailure() { steps.push('tool_failure'); return true; },
        async timeout() { steps.push('timeout'); return true; },
        async fallback() { steps.push('fallback'); return true; },
        async goldenCases() { steps.push('golden_cases'); return true; },
      },
      destructiveToolExecutor: destructiveTool,
    });

    expect(steps).toEqual([
      'connection',
      'structured_output',
      'tool_calling',
      'tool_failure',
      'timeout',
      'fallback',
      'golden_cases',
    ]);
    expect(destructiveTool).not.toHaveBeenCalled();
    expect(result.status).toBe('CERTIFIED');
    expect(store.read()).toHaveLength(1);
  });

  it('qualquer etapa falha impede certificação', async () => {
    const store = memoryStore();

    const result = await runProviderCertification({
      provider: 'anthropic',
      model: 'claude-test',
      store,
      adapter: {
        async connection() { return true; },
        async structuredOutput() { return true; },
        async toolCalling() { return false; },
        async toolFailure() { return true; },
        async timeout() { return true; },
        async fallback() { return true; },
        async goldenCases() { return true; },
      },
      destructiveToolExecutor: vi.fn(),
    });

    expect(result.status).not.toBe('CERTIFIED');
    expect(result.evidence.find((item) => item.step === 'tool_calling')).toMatchObject({ passed: false });
  });
});
