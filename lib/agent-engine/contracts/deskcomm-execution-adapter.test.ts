import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendTurnMessage } from '../edge/crm/send-message';
import {
  DeskcommExecutionAdapter,
  createPostgresDeskcommExecutionPersistence,
  shouldExecuteSideEffect,
  type DeskcommExecutionRecord,
  type DeskcommExecutionPersistence,
} from '../execution/deskcomm-execution-adapter';

const sendMessageHandlerMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/v1/messages/_handler', () => ({
  sendMessageHandler: sendMessageHandlerMock,
}));

const identity = {
  runId: 'run-1',
  organizationId: 'org-1',
  agentId: 'agent-1',
  agentVersion: 'v1',
  traceId: 'trace-1',
  correlationId: 'corr-1',
} as const;

function memoryPersistence(initial?: DeskcommExecutionRecord): {
  persistence: DeskcommExecutionPersistence;
  read: () => DeskcommExecutionRecord | null;
} {
  let record = initial ?? null;

  return {
    persistence: {
      async load() {
        return record;
      },
      async save(next) {
        record = next;
      },
    },
    read: () => record,
  };
}

function memorySendDb() {
  let ledger:
    | {
        id: string;
        organization_id: string;
        contact_id: string | null;
        job_id: string;
        seq: number;
        body_hash: string;
        status: 'requested' | 'accepted' | 'queued' | 'vetoed' | 'failed';
        crm_message_id: string | null;
        last_error: string | null;
      }
    | null = null;

  const query = vi.fn(async (sql: string, values?: unknown[]) => {
    if (sql.includes('insert into send_ledger')) {
      if (ledger !== null) {
        const err = new Error('duplicate key') as Error & { code?: string };
        err.code = '23505';
        throw err;
      }

      ledger = {
        id: 'ledger-1',
        organization_id: String(values?.[0] ?? ''),
        contact_id: (values?.[1] as string | null | undefined) ?? null,
        job_id: String(values?.[2] ?? ''),
        seq: Number(values?.[3] ?? 0),
        body_hash: String(values?.[4] ?? ''),
        status: 'requested',
        crm_message_id: null,
        last_error: null,
      };
      return { rows: [{ id: ledger.id }], rowCount: 1 };
    }

    if (sql.includes('select * from send_ledger')) {
      return { rows: ledger === null ? [] : [ledger], rowCount: ledger === null ? 0 : 1 };
    }

    if (sql.includes('select id, status from messages')) {
      return { rows: [], rowCount: 0 };
    }

    if (sql.includes('update send_ledger') && sql.includes('set status = $2')) {
      if (ledger === null) throw new Error('ledger ausente');
      ledger.status = values?.[1] as typeof ledger.status;
      ledger.crm_message_id = (values?.[2] as string | null | undefined) ?? ledger.crm_message_id;
      ledger.last_error = (values?.[3] as string | null | undefined) ?? null;
      return { rows: [], rowCount: 1 };
    }

    throw new Error(`query inesperada no fake: ${sql}`);
  });

  return { query } as never;
}

describe('DeskcommExecutionAdapter', () => {
  it('inicia um run novo como running e persiste a identidade de execução', async () => {
    const memory = memoryPersistence();
    const adapter = new DeskcommExecutionAdapter(memory.persistence);

    const state = await adapter.start({
      jobId: 'job-1',
      workerId: 'worker-1',
      identity,
    });

    expect(state.status).toBe('running');
    expect(state.jobId).toBe('job-1');
    expect(state.checkpoint).toBeNull();
    expect(state.completedSideEffectKeys).toEqual([]);
    expect(memory.read()).toEqual(state);
  });

  it('checkpoint sobrevive a pause e resume sem perder passos concluídos', async () => {
    const memory = memoryPersistence();
    const adapter = new DeskcommExecutionAdapter(memory.persistence);
    const started = await adapter.start({ jobId: 'job-1', workerId: 'worker-1', identity });

    const checkpointed = await adapter.checkpoint(started, {
      stepId: 'step-2',
      data: { stage: 'qualified' },
      completedSideEffectKeys: ['idem-1'],
    });
    const paused = await adapter.pause(checkpointed, 'approval_required');
    const resumed = await adapter.resume(paused);

    expect(paused.status).toBe('waiting_approval');
    expect(resumed.status).toBe('running');
    expect(resumed.checkpoint).toEqual({
      stepId: 'step-2',
      data: { stage: 'qualified' },
    });
    expect(resumed.completedSideEffectKeys).toEqual(['idem-1']);
  });

  it('reabre o checkpoint persistido após interrupção e não repete side effect concluído', async () => {
    const previous: DeskcommExecutionRecord = {
      ...identity,
      jobId: 'job-1',
      workerId: 'worker-old',
      status: 'running',
      steps: 2,
      toolCalls: 1,
      tokensUsed: 500,
      costCents: 2,
      checkpoint: { stepId: 'step-2', data: { stage: 'qualified' } },
      completedSideEffectKeys: ['idem-send-1'],
    };
    const memory = memoryPersistence(previous);
    const adapter = new DeskcommExecutionAdapter(memory.persistence);

    const resumed = await adapter.start({
      jobId: 'job-1',
      workerId: 'worker-new',
      identity,
    });

    expect(resumed.checkpoint?.stepId).toBe('step-2');
    expect(resumed.workerId).toBe('worker-new');
    expect(shouldExecuteSideEffect(resumed, 'idem-send-1')).toBe(false);
    expect(shouldExecuteSideEffect(resumed, 'idem-send-2')).toBe(true);
  });

  it('persistência Postgres usa job_queue como checkpoint durável e event_log como trilha', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 1 });
    const persistence = createPostgresDeskcommExecutionPersistence({ query } as never);
    const record: DeskcommExecutionRecord = {
      ...identity,
      jobId: 'job-1',
      workerId: 'worker-1',
      status: 'running',
      steps: 1,
      toolCalls: 0,
      tokensUsed: 0,
      costCents: 0,
      checkpoint: { stepId: 'step-1', data: { ok: true } },
      completedSideEffectKeys: [],
    };

    await persistence.save(record);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql] = query.mock.calls[0] as [string, ...unknown[]];
    expect(sql).toContain('job_queue');
    expect(sql).toContain('event_log');
    expect(sql).toContain('agent_os_execution');
  });

  it('registra stopReason também no encerramento bem-sucedido', async () => {
    const memory = memoryPersistence();
    const adapter = new DeskcommExecutionAdapter(memory.persistence);
    const started = await adapter.start({ jobId: 'job-1', workerId: 'worker-1', identity });

    const completed = await adapter.complete(started, { ok: true });

    expect(completed.status).toBe('completed');
    expect(completed.stopReason).toBe('completed');
    expect(memory.read()?.stopReason).toBe('completed');
  });

  it('persiste motivo determinístico ao parar por budget', async () => {
    const memory = memoryPersistence();
    const adapter = new DeskcommExecutionAdapter(memory.persistence);
    const started = await adapter.start({ jobId: 'job-1', workerId: 'worker-1', identity });

    const stopped = await adapter.stop(
      started,
      'budget_exhausted',
      'max_steps_exhausted',
    );

    expect(stopped.status).toBe('budget_exhausted');
    expect(stopped.stopReason).toBe('max_steps_exhausted');
    expect(memory.read()?.stopReason).toBe('max_steps_exhausted');
  });
});

describe('send_message retry safety', () => {
  beforeEach(() => {
    sendMessageHandlerMock.mockReset();
    sendMessageHandlerMock.mockResolvedValue({ id: 'msg-1', status: 'sent' });
  });

  it('replay do mesmo job+seq não chama o handler de envio duas vezes', async () => {
    const db = memorySendDb();
    const cfg = { supabase: {} as never };
    const input = {
      tenantId: 'org-1',
      leadId: 'contact-1',
      jobId: 'job-1',
      seq: 1,
      conversationId: 'conv-1',
      body: 'Olá! Posso ajudar?',
    };

    const first = await sendTurnMessage(db, cfg, input);
    const replay = await sendTurnMessage(db, cfg, input);

    expect(first).toMatchObject({ kind: 'sent', idempotencyKey: 'ledger-1', crmMessageId: 'msg-1' });
    expect(replay).toMatchObject({ kind: 'already_sent', idempotencyKey: 'ledger-1', crmMessageId: 'msg-1' });
    expect(sendMessageHandlerMock).toHaveBeenCalledTimes(1);
  });
});
