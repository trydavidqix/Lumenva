import type pg from 'pg';

import type { LearningScope } from '../flywheel/contracts';
import type { LearningSignal } from '../flywheel/signals';
import type { JobKind, JobStatus } from '../queue/queue';
import {
  nativeJobOutcomeToRuntimeObservation,
  runtimeObservationToLearningSignal,
} from './runtime-events';

const OBSERVED_JOB_KINDS: readonly JobKind[] = [
  'inbound_turn',
  'followup_turn',
  'case_reply_turn',
  'operator_turn',
];
const TERMINAL_STATUSES: readonly JobStatus[] = ['done', 'failed', 'dead'];

interface RuntimeJobRow {
  id: string;
  organization_id: string;
  kind: JobKind;
  status: JobStatus;
  last_error: string | null;
  created_at: Date;
  payload: Record<string, unknown>;
}

export interface NativeRuntimeSignalSink {
  resolveScope(input: { organizationId: string; jobId: string }): Promise<LearningScope | null>;
  emitSignal(signal: LearningSignal): Promise<void>;
}

/**
 * Reads the one durable native completion/error boundary: job_queue after the
 * worker has called completeJob/cancelJob/failJob-to-dead. This deliberately does
 * not hook the customer request path; learning remains asynchronous and bounded.
 * Signal ids are deterministic per job terminal state so durable consumers can
 * de-duplicate repeated learning sweeps.
 */
export async function collectNativeRuntimeSignals(
  pool: pg.Pool,
  input: {
    sink: NativeRuntimeSignalSink;
    limit: number;
    observedAt?: string;
  },
): Promise<{ scanned: number; emitted: number; skipped: number }> {
  const limit = Math.max(0, Math.min(Math.trunc(input.limit), 500));
  if (limit === 0) return { scanned: 0, emitted: 0, skipped: 0 };

  const { rows } = await pool.query<RuntimeJobRow>(
    `select id, organization_id, kind, status, last_error, created_at, payload
       from job_queue
      where status = any($1::text[])
        and kind = any($2::text[])
      order by created_at desc, id desc
      limit $3`,
    [TERMINAL_STATUSES, OBSERVED_JOB_KINDS, limit],
  );

  let emitted = 0;
  let skipped = 0;
  const observedAt = input.observedAt ?? new Date().toISOString();

  for (const job of rows) {
    const scope = await input.sink.resolveScope({
      organizationId: job.organization_id,
      jobId: job.id,
    });
    if (!scope) {
      skipped += 1;
      continue;
    }
    if (scope.organizationId !== job.organization_id) {
      throw new Error('hermes_runtime_tenant_authority_mismatch');
    }

    const observation = nativeJobOutcomeToRuntimeObservation(job, scope, observedAt);
    await input.sink.emitSignal(runtimeObservationToLearningSignal(observation));
    emitted += 1;
  }

  return { scanned: rows.length, emitted, skipped };
}
