import type { Queryable } from '../queue/queue';
import {
  isAgentRunTransitionAllowed,
  type AgentRunIdentity,
  type AgentRunStatus,
  type ExecutionPort,
} from '../contracts/agent-os';

export interface LumenvaExecutionCheckpoint {
  stepId: string;
  data: unknown;
}

export interface LumenvaExecutionCheckpointInput extends LumenvaExecutionCheckpoint {
  completedSideEffectKeys?: readonly string[];
}

export interface LumenvaExecutionRecord extends AgentRunIdentity {
  jobId: string;
  workerId: string;
  status: AgentRunStatus;
  steps: number;
  toolCalls: number;
  tokensUsed: number;
  costCents: number;
  checkpoint: LumenvaExecutionCheckpoint | null;
  completedSideEffectKeys: string[];
  stopReason?: string;
}

export interface LumenvaExecutionStartInput {
  jobId: string;
  workerId: string;
  identity: AgentRunIdentity;
}

export interface LumenvaExecutionPersistence {
  load(input: { jobId: string; organizationId: string }): Promise<LumenvaExecutionRecord | null>;
  save(record: LumenvaExecutionRecord): Promise<void>;
}

type AgentStopStatus = Exclude<
  AgentRunStatus,
  'running' | 'waiting_approval' | 'retryable_failure' | 'completed'
>;

export function shouldExecuteSideEffect(
  state: Pick<LumenvaExecutionRecord, 'completedSideEffectKeys'>,
  idempotencyKey: string,
): boolean {
  return !state.completedSideEffectKeys.includes(idempotencyKey);
}

export class LumenvaExecutionAdapter
  implements ExecutionPort<
    LumenvaExecutionStartInput,
    LumenvaExecutionRecord,
    LumenvaExecutionCheckpointInput,
    unknown,
    unknown
  >
{
  constructor(private readonly persistence: LumenvaExecutionPersistence) {}

  async start(input: LumenvaExecutionStartInput): Promise<LumenvaExecutionRecord> {
    const existing = await this.persistence.load({
      jobId: input.jobId,
      organizationId: input.identity.organizationId,
    });

    if (existing) {
      const resumedByWorker: LumenvaExecutionRecord = {
        ...existing,
        workerId: input.workerId,
      };
      await this.persistence.save(resumedByWorker);
      return resumedByWorker;
    }

    const created: LumenvaExecutionRecord = {
      ...input.identity,
      jobId: input.jobId,
      workerId: input.workerId,
      status: 'running',
      steps: 0,
      toolCalls: 0,
      tokensUsed: 0,
      costCents: 0,
      checkpoint: null,
      completedSideEffectKeys: [],
    };

    await this.persistence.save(created);
    return created;
  }

  async checkpoint(
    state: LumenvaExecutionRecord,
    checkpoint: LumenvaExecutionCheckpointInput,
  ): Promise<LumenvaExecutionRecord> {
    const completedSideEffectKeys = Array.from(
      new Set([
        ...state.completedSideEffectKeys,
        ...(checkpoint.completedSideEffectKeys ?? []),
      ]),
    );

    const next: LumenvaExecutionRecord = {
      ...state,
      checkpoint: {
        stepId: checkpoint.stepId,
        data: checkpoint.data,
      },
      completedSideEffectKeys,
    };

    await this.persistence.save(next);
    return next;
  }

  async pause(state: LumenvaExecutionRecord, reason: string): Promise<LumenvaExecutionRecord> {
    return this.transition(state, 'waiting_approval', reason);
  }

  async resume(state: LumenvaExecutionRecord): Promise<LumenvaExecutionRecord> {
    return this.transition(state, 'running');
  }

  async complete(state: LumenvaExecutionRecord, _result: unknown): Promise<LumenvaExecutionRecord> {
    return this.transition(state, 'completed', 'completed');
  }

  async stop(
    state: LumenvaExecutionRecord,
    status: AgentStopStatus,
    reason: string,
  ): Promise<LumenvaExecutionRecord> {
    return this.transition(state, status, reason);
  }

  async fail(state: LumenvaExecutionRecord, failure: unknown): Promise<LumenvaExecutionRecord> {
    const reason = failure instanceof Error ? failure.message : String(failure);
    return this.transition(state, 'permanent_failure', reason);
  }

  private async transition(
    state: LumenvaExecutionRecord,
    status: AgentRunStatus,
    stopReason?: string,
  ): Promise<LumenvaExecutionRecord> {
    if (!isAgentRunTransitionAllowed(state.status, status)) {
      throw new Error(`invalid_agent_run_transition:${state.status}->${status}`);
    }

    const next: LumenvaExecutionRecord = {
      ...state,
      status,
      ...(stopReason === undefined ? {} : { stopReason }),
    };

    await this.persistence.save(next);
    return next;
  }
}

export function createPostgresLumenvaExecutionPersistence(
  db: Queryable,
): LumenvaExecutionPersistence {
  return {
    async load({ jobId, organizationId }) {
      const { rows } = await db.query<{ agent_os_execution: LumenvaExecutionRecord | null }>(
        `select payload->'agent_os_execution' as agent_os_execution
           from job_queue
          where id = $1 and organization_id = $2
          limit 1`,
        [jobId, organizationId],
      );

      return rows[0]?.agent_os_execution ?? null;
    },

    async save(record) {
      const snapshot = JSON.stringify(record);
      await db.query(
        `with persisted as (
           update job_queue
              set payload = jsonb_set(
                coalesce(payload, '{}'::jsonb),
                '{agent_os_execution}',
                $2::jsonb,
                true
              )
            where id = $1 and organization_id = $3
            returning id
         )
         insert into event_log
           (organization_id, event_type, entity_kind, entity_id, payload, metadata)
         select
           $3,
           'agent_os_execution',
           'job_queue',
           id,
           $2::jsonb,
           jsonb_build_object(
             'run_id', $4,
             'trace_id', $5,
             'correlation_id', $6
           )
         from persisted`,
        [
          record.jobId,
          snapshot,
          record.organizationId,
          record.runId,
          record.traceId,
          record.correlationId,
        ],
      );
    },
  };
}
