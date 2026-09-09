/**
 * Task 3: Observability — Sentry + structured logging for proposal workflow.
 */

/**
 * TODO Step 3.1: Sentry setup
 * - Initialize Sentry with workflow context
 * - Breadcrumbs: workflow_run_id, organization_id, decision outcomes
 * - Tags: feature_flag (OFF/SHADOW/ON/CANARY), role (manager/admin)
 * - Release version tracking
 *
 * Events:
 * - workflow.created
 * - workflow.drafted
 * - workflow.decision (approve/reject/edit)
 * - workflow.send_started
 * - workflow.send_completed (blocked/failed/sent)
 * - workflow.followup_scheduled
 */

import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger';
import type { Pool } from 'pg';

export function initWorkflowObservability() {
  // TODO: Configure Sentry for workflow events
  // Sentry.init({
  //   dsn: process.env.SENTRY_DSN,
  //   tracesSampleRate: 0.1,
  //   beforeSend: (event) => {
  //     // Filter out noisy events, redact PII
  //     return event;
  //   }
  // });
}

export function recordWorkflowEvent(
  workflowRunId: string,
  event: string,
  data: Record<string, unknown>,
) {
  // TODO Step 3.1: Sentry breadcrumb
  Sentry.captureMessage(`workflow.${event}`, {
    level: 'info',
    contexts: {
      workflow: {
        run_id: workflowRunId,
        ...data,
      },
    },
  });

  // TODO Step 3.2: Structured log
  logger.info(`workflow.${event}`, {
    workflow_run_id: workflowRunId,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

/**
 * TODO Step 3.4: Checkpoint performance monitoring
 * Query langgraph_internal.checkpoints table to measure:
 * - Checkpoint write latency (insert time)
 * - Resume latency (created_at to resume time)
 * - Checkpoint size bytes
 * - Compression ratio (if applicable)
 *
 * Example query:
 * SELECT
 *   thread_id,
 *   checkpoint_id,
 *   (now() - created_at) as age_ms,
 *   pg_column_size(checkpoint_data) as size_bytes
 * FROM langgraph_internal.checkpoints
 * WHERE thread_id = $1
 * ORDER BY created_at DESC LIMIT 1;
 */
export async function monitorCheckpointPerformance(threadId: string, db: Pool) {
  // TODO: Query checkpoint table, emit metrics
}
