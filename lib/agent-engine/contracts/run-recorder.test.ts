import { describe, expect, it } from 'vitest';

import {
  createRunRecorder,
  type RunRecordStore,
} from '../obs/run-recorder';

function memoryStore(): RunRecordStore & { read: () => unknown[] } {
  const rows: unknown[] = [];
  return {
    async append(entry) {
      rows.push(entry);
    },
    read: () => rows,
  };
}

describe('Agent OS RunRecorder', () => {
  it('registra run completo com identidade, modelo, tools, policy, approval e métricas', async () => {
    const store = memoryStore();
    const recorder = createRunRecorder(store, {
      organizationId: 'org-1',
      runId: 'run-1',
      traceId: 'trace-1',
      correlationId: 'corr-1',
      agentId: 'agent-1',
      agentVersionId: 'ver-1',
      trigger: 'inbound_message',
      provider: 'openai',
      model: 'gpt-test',
    });

    await recorder.context({ eventId: 'evt-1', jobId: 'job-1', sources: ['conversation:conv-1'] });
    await recorder.skills(['skill:qualification@2']);
    await recorder.step({ step: 1, kind: 'model' });
    await recorder.policy({ toolId: 'send_message', decision: 'require_approval' });
    await recorder.approval({ approvalId: 'approval-1', status: 'approved' });
    await recorder.tool({ toolId: 'send_message', status: 'completed', attempt: 1 });
    await recorder.retry({ reason: 'provider_timeout', attempt: 2 });
    await recorder.usage({ tokensIn: 120, tokensOut: 40, costUsd: 0.02, latencyMs: 800 });
    await recorder.complete({ stopReason: 'completed', verification: 'passed' });

    const rows = store.read() as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThanOrEqual(8);
    expect(rows.every((row) => row.runId === 'run-1')).toBe(true);
    expect(rows.every((row) => row.traceId === 'trace-1')).toBe(true);
    expect(rows.some((row) => row.kind === 'policy')).toBe(true);
    expect(rows.some((row) => row.kind === 'approval')).toBe(true);
    expect(rows.some((row) => row.kind === 'usage')).toBe(true);
    expect(rows.at(-1)).toMatchObject({
      kind: 'terminal',
      status: 'completed',
      stopReason: 'completed',
      verification: 'passed',
    });
  });

  it('falha terminal continua atribuível a provider/model/custo/latência', async () => {
    const store = memoryStore();
    const recorder = createRunRecorder(store, {
      organizationId: 'org-1',
      runId: 'run-2',
      traceId: 'trace-2',
      correlationId: 'corr-2',
      agentId: 'agent-1',
      agentVersionId: 'ver-1',
      trigger: 'inbound_message',
      provider: 'anthropic',
      model: 'claude-test',
    });

    await recorder.usage({ tokensIn: 50, tokensOut: 0, costUsd: 0.01, latencyMs: 1200 });
    await recorder.fail({ stopReason: 'provider_failure', errorCode: 'timeout' });

    expect(store.read().at(-1)).toMatchObject({
      kind: 'terminal',
      status: 'failed',
      stopReason: 'provider_failure',
      provider: 'anthropic',
      model: 'claude-test',
    });
  });
});
