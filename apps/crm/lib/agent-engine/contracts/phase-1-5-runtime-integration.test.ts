import { describe, expect, it, vi } from 'vitest';

const RUN_IDENTITY = {
  organizationId: 'org-1',
  runId: 'job-1',
  traceId: 'trace-1',
  correlationId: 'corr-1',
  agentId: 'agent-1',
  agentVersionId: 'ver-1',
  trigger: 'inbound_message',
  provider: 'openai',
  model: 'gpt-test',
} as const;

describe('Agent OS phase 1.5 canonical runtime integration', () => {
  it('deriva event -> job/run trace da identidade durável e preserva essa identidade no recorder canônico', async () => {
    const traceModule = await import('../obs/trace-context');
    const recorderModule = await import('../obs/run-recorder');
    const traceContextFromJob = (traceModule as Record<string, unknown>).traceContextFromJob;
    const createRunRecorder = (recorderModule as Record<string, unknown>).createRunRecorder;
    expect(typeof traceContextFromJob).toBe('function');
    expect(typeof createRunRecorder).toBe('function');

    const trace = (traceContextFromJob as (job: unknown) => Record<string, unknown>)({
      id: 'job-1',
      organization_id: 'org-1',
      source_event_id: 'evt-1',
      payload: { trace_id: 'trace-1', correlation_id: 'corr-1' },
    });

    expect(trace).toMatchObject({
      organizationId: 'org-1',
      eventId: 'evt-1',
      jobId: 'job-1',
      runId: 'job-1',
      traceId: 'trace-1',
      correlationId: 'corr-1',
    });

    const rows: Array<Record<string, unknown>> = [];
    const recorder = (createRunRecorder as (
      store: { append: (entry: Record<string, unknown>) => Promise<void> },
      identity: Record<string, unknown>,
    ) => { context: (payload: Record<string, unknown>) => Promise<void> })(
      { append: async (entry) => void rows.push(entry) },
      {
        ...RUN_IDENTITY,
        organizationId: trace.organizationId,
        runId: trace.runId,
        traceId: trace.traceId,
        correlationId: trace.correlationId,
      },
    );

    await recorder.context({
      eventId: trace.eventId,
      jobId: trace.jobId,
      sources: ['job_queue:job-1'],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      organizationId: 'org-1',
      eventId: 'evt-1',
      jobId: 'job-1',
      runId: 'job-1',
      traceId: 'trace-1',
      correlationId: 'corr-1',
      kind: 'context',
    });
  });

  it('RunRecorder persiste detalhe no event_log e projeta terminal/usage em ai_agent_runs', async () => {
    const recorderModule = await import('../obs/run-recorder');
    const factory = (recorderModule as Record<string, unknown>).createPostgresRunRecordStore;
    expect(typeof factory).toBe('function');

    const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const db = {
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        queries.push({ sql, values });
        return { rows: [], rowCount: 1 };
      }),
    };
    const store = (factory as (db: unknown) => { append: (entry: unknown) => Promise<void> })(db);

    await store.append({
      ...RUN_IDENTITY,
      kind: 'usage',
      recordedAt: '2026-08-17T16:00:00.000Z',
      tokensIn: 100,
      tokensOut: 20,
      costUsd: 0.02,
      latencyMs: 500,
    });
    await store.append({
      ...RUN_IDENTITY,
      kind: 'terminal',
      recordedAt: '2026-08-17T16:00:01.000Z',
      status: 'completed',
      stopReason: 'completed',
      verification: 'passed',
    });

    expect(queries.some((q) => q.sql.includes('insert into event_log'))).toBe(true);
    expect(queries.some((q) => q.sql.includes('update ai_agent_runs'))).toBe(true);
    expect(
      queries.some(
        (q) => q.sql.includes('event_log') && q.sql.includes('organization_id') && q.sql.includes('metadata'),
      ),
    ).toBe(true);
  });

  it('provider/fallback events têm sink Postgres no event_log canônico', async () => {
    const providerModule = await import('../obs/provider-events');
    const factory = (providerModule as Record<string, unknown>).createPostgresProviderEventSink;
    expect(typeof factory).toBe('function');

    const queries: string[] = [];
    const db = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        return { rows: [], rowCount: 1 };
      }),
    };
    const sink = (factory as (db: unknown) => { emit: (event: unknown) => Promise<void> })(db);
    await sink.emit({
      kind: 'fallback_start',
      attemptId: 'attempt-2',
      priorAttemptId: 'attempt-1',
      organizationId: 'org-1',
      runId: 'job-1',
      traceId: 'trace-1',
      correlationId: 'corr-1',
      provider: 'anthropic',
      model: 'claude-test',
      recordedAt: '2026-08-17T16:00:00.000Z',
    });

    expect(queries.some((sql) => sql.includes('insert into event_log'))).toBe(true);
  });

  it('certificação persiste dentro de ai_models.metadata em vez de criar tabela paralela', async () => {
    const certificationModule = await import('../models/provider-certification');
    const factory = (certificationModule as Record<string, unknown>).createPostgresModelCertificationStore;
    expect(typeof factory).toBe('function');

    const queries: Array<{ sql: string; values?: unknown[] }> = [];
    const db = {
      query: vi.fn(async (sql: string, values?: unknown[]) => {
        queries.push({ sql, values });
        return { rows: [], rowCount: 1 };
      }),
    };
    const store = (factory as (db: unknown) => { save: (record: unknown) => Promise<void> })(db);
    await store.save({
      provider: 'openai',
      model: 'gpt-test',
      status: 'CERTIFIED',
      evidence: [{ step: 'connection', passed: true }],
      certifiedAt: '2026-08-17T16:00:00.000Z',
    });

    expect(queries).toHaveLength(1);
    expect(queries[0]?.sql).toContain('update ai_models');
    expect(queries[0]?.sql).toContain('metadata');
    expect(queries[0]?.sql).toContain('model_id');
  });

  it('telemetry externa reutiliza AiTracer e carrega os IDs internos como source of truth', async () => {
    const telemetryModule = await import('../obs/telemetry-bridge');
    const factory = (telemetryModule as Record<string, unknown>).createAiTracerTelemetryAdapter;
    expect(typeof factory).toBe('function');

    const end = vi.fn(async () => undefined);
    const startSpan = vi.fn(async () => ({ end }));
    const adapter = (factory as (tracer: unknown) => { publish: (payload: unknown) => Promise<void> })({
      startSpan,
    });

    await adapter.publish({
      organizationId: 'org-1',
      eventId: 'evt-1',
      jobId: 'job-1',
      runId: 'job-1',
      traceId: 'trace-1',
      correlationId: 'corr-1',
      provider: 'openai',
      model: 'gpt-test',
      tokensIn: 100,
      tokensOut: 20,
      costUsd: 0.02,
      latencyMs: 500,
    });

    expect(startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'job-1',
        traceId: 'trace-1',
        organizationId: 'org-1',
        metadata: expect.objectContaining({
          event_id: 'evt-1',
          job_id: 'job-1',
          correlation_id: 'corr-1',
        }),
      }),
    );
    expect(end).toHaveBeenCalledWith(
      expect.objectContaining({
        metrics: expect.objectContaining({
          tokens_in: 100,
          tokens_out: 20,
          cost_usd: 0.02,
          latency_ms: 500,
        }),
      }),
    );
  });
});
