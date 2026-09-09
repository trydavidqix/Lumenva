import type { Queryable } from '../queue/queue';

export interface RunRecordStore {
  append(entry: RunRecordEntry): Promise<void>;
}

export interface RunRecorderIdentity {
  organizationId: string;
  runId: string;
  traceId: string;
  correlationId: string;
  agentId: string;
  agentVersionId: string;
  trigger: string;
  provider: string;
  model: string;
}

export interface RunRecordEntry extends RunRecorderIdentity {
  kind: string;
  recordedAt: string;
  [key: string]: unknown;
}

function now(): string {
  return new Date().toISOString();
}

function cents(costUsd: unknown): number | null {
  return typeof costUsd === 'number' && Number.isFinite(costUsd)
    ? Math.round(costUsd * 100)
    : null;
}

/**
 * Canonical durable store for Agent OS run detail. `event_log` remains the
 * append-only source of truth; `ai_agent_runs` is updated as the existing
 * summary/projection when usage or terminal records arrive.
 */
export function createPostgresRunRecordStore(db: Queryable): RunRecordStore {
  return {
    async append(entry) {
      await db.query(
        `insert into event_log
           (organization_id, event_type, entity_kind, entity_id, payload, metadata)
         values ($1, $2, 'agent_run', $3, $4::jsonb, $5::jsonb)`,
        [
          entry.organizationId,
          `agent_os.run.${entry.kind}`,
          entry.runId,
          JSON.stringify(entry),
          JSON.stringify({
            run_id: entry.runId,
            trace_id: entry.traceId,
            correlation_id: entry.correlationId,
            agent_id: entry.agentId,
            agent_version_id: entry.agentVersionId,
            provider: entry.provider,
            model: entry.model,
            record_kind: entry.kind,
          }),
        ],
      );

      if (entry.kind === 'usage') {
        await db.query(
          `update ai_agent_runs
             set tokens_in = $3,
                 tokens_out = $4,
                 cost_cents = $5,
                 latency_ms = $6
           where id = $1 and organization_id = $2`,
          [
            entry.runId,
            entry.organizationId,
            typeof entry.tokensIn === 'number' ? entry.tokensIn : null,
            typeof entry.tokensOut === 'number' ? entry.tokensOut : null,
            cents(entry.costUsd),
            typeof entry.latencyMs === 'number' ? entry.latencyMs : null,
          ],
        );
      }

      if (entry.kind === 'terminal') {
        const status = entry.status === 'completed' ? 'completed' : 'failed';
        await db.query(
          `update ai_agent_runs
             set status = $3,
                 completed_at = $4,
                 abort_reason = $5,
                 error_code = $6
           where id = $1 and organization_id = $2`,
          [
            entry.runId,
            entry.organizationId,
            status,
            entry.recordedAt,
            typeof entry.stopReason === 'string' ? entry.stopReason : null,
            typeof entry.errorCode === 'string' ? entry.errorCode : null,
          ],
        );
      }
    },
  };
}

export function createRunRecorder(store: RunRecordStore, identity: RunRecorderIdentity) {
  const append = async (kind: string, payload: Record<string, unknown> = {}): Promise<void> => {
    await store.append({
      ...identity,
      ...payload,
      kind,
      recordedAt: now(),
    });
  };

  return {
    context(payload: { eventId: string; jobId: string; sources: string[] }) {
      return append('context', payload);
    },
    skills(skills: string[]) {
      return append('skills', { skills });
    },
    step(payload: { step: number; kind: string }) {
      return append('step', payload);
    },
    policy(payload: { toolId: string; decision: string }) {
      return append('policy', payload);
    },
    approval(payload: { approvalId: string; status: string }) {
      return append('approval', payload);
    },
    tool(payload: { toolId: string; status: string; attempt: number }) {
      return append('tool', payload);
    },
    retry(payload: { reason: string; attempt: number }) {
      return append('retry', payload);
    },
    usage(payload: {
      tokensIn: number;
      tokensOut: number;
      costUsd: number;
      latencyMs: number;
    }) {
      return append('usage', payload);
    },
    complete(payload: { stopReason: string; verification: string }) {
      return append('terminal', {
        status: 'completed',
        ...payload,
      });
    },
    fail(payload: { stopReason: string; errorCode: string }) {
      return append('terminal', {
        status: 'failed',
        ...payload,
      });
    },
  };
}
