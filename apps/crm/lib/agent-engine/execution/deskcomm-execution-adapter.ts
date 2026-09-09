import type { Queryable } from '../queue/queue';
import {
  isAgentRunTransitionAllowed,
  type AgentRunIdentity,
  type AgentRunStatus,
  type ExecutionPort,
} from '../contracts/agent-os';

export interface DeskcommExecutionCheckpoint {
  stepId: string;
  data: unknown;
}

export interface DeskcommExecutionCheckpointInput extends DeskcommExecutionCheckpoint {
  completedSideEffectKeys?: readonly string[];
}

export interface DeskcommExecutionRecord extends AgentRunIdentity {
  jobId: string;
  workerId: string;
  status: AgentRunStatus;
  steps: number;
  toolCalls: number;
  tokensUsed: number;
  costCents: number;
  checkpoint: DeskcommExecutionCheckpoint | null;
  completedSideEffectKeys: string[];
  stopReason?: string;
}

export interface DeskcommExecutionStartInput {
  jobId: string;
  workerId: string;
  identity: AgentRunIdentity;
}

export interface DeskcommExecutionPersistence {
  load(input: { jobId: string; organizationId: string }): Promise<DeskcommExecutionRecord | null>;
  save(record: DeskcommExecutionRecord): Promise<void>;
}

type AgentStopStatus = Exclude<
  AgentRunStatus,
  'running' | 'waiting_approval' | 'retryable_failure' | 'completed'
>;

export function shouldExecuteSideEffect(
  state: Pick<DeskcommExecutionRecord, 'completedSideEffectKeys'>,
  idempotencyKey: string,
): boolean {
  return !state.completedSideEffectKeys.includes(idempotencyKey);
}

export class DeskcommExecutionAdapter
  implements ExecutionPort<
    DeskcommExecutionStartInput,
    DeskcommExecutionRecord,
    DeskcommExecutionCheckpointInput,
    unknown,
    unknown
  >
{
  constructor(private readonly persistence: DeskcommExecutionPersistence) {}

  async start(input: DeskcommExecutionStartInput): Promise<DeskcommExecutionRecord> {
    const existing = await this.persistence.load({
      jobId: input.jobId,
      organizationId: input.identity.organizationId,
    });

    if (existing) {
      const resumedByWorker: DeskcommExecutionRecord = {
        ...existing,
        workerId: input.workerId,
      };
      await this.persistence.save(resumedByWorker);
      return resumedByWorker;
    }

    const created: DeskcommExecutionRecord = {
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
    state: DeskcommExecutionRecord,
    checkpoint: DeskcommExecutionCheckpointInput,
  ): Promise<DeskcommExecutionRecord> {
    const completedSideEffectKeys = Array.from(
      new Set([
        ...state.completedSideEffectKeys,
        ...(checkpoint.completedSideEffectKeys ?? []),
      ]),
    );

    const next: DeskcommExecutionRecord = {
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

  async pause(state: DeskcommExecutionRecord, reason: string): Promise<DeskcommExecutionRecord> {
    return this.transition(state, 'waiting_approval', reason);
  }

  async resume(state: DeskcommExecutionRecord): Promise<DeskcommExecutionRecord> {
    return this.transition(state, 'running');
  }

  async complete(state: DeskcommExecutionRecord, _result: unknown): Promise<DeskcommExecutionRecord> {
    return this.transition(state, 'completed', 'completed');
  }

  async stop(
    state: DeskcommExecutionRecord,
    status: AgentStopStatus,
    reason: string,
  ): Promise<DeskcommExecutionRecord> {
    return this.transition(state, status, reason);
  }

  async fail(state: DeskcommExecutionRecord, failure: unknown): Promise<DeskcommExecutionRecord> {
    const reason = failure instanceof Error ? failure.message : String(failure);
    return this.transition(state, 'permanent_failure', reason);
  }

  private async transition(
    state: DeskcommExecutionRecord,
    status: AgentRunStatus,
    stopReason?: string,
  ): Promise<DeskcommExecutionRecord> {
    if (!isAgentRunTransitionAllowed(state.status, status)) {
      throw new Error(`invalid_agent_run_transition:${state.status}->${status}`);
    }

    const next: DeskcommExecutionRecord = {
      ...state,
      status,
      ...(stopReason === undefined ? {} : { stopReason }),
    };

    await this.persistence.save(next);
    return next;
  }
}

export function createPostgresDeskcommExecutionPersistence(
  db: Queryable,
): DeskcommExecutionPersistence {
  return {
    async load({ jobId, organizationId }) {
      const { rows } = await db.query<{ agent_os_execution: DeskcommExecutionRecord | null }>(
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
