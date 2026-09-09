/**
 * Task 3: Proposal workflow metrics — Sentry + structured logging.
 */

// import * as Sentry from '@sentry/node'; // Optional: requires @sentry/node package
import { logger } from '@/lib/logger';

export interface WorkflowMetrics {
  runId: string;
  organizationId: string;
  stage: 'draft' | 'decide' | 'send' | 'completed';
  duration?: number;
  result?: 'approve' | 'reject' | 'edit' | 'sent' | 'blocked' | 'failed';
  metadata?: Record<string, unknown>;
}

export function recordWorkflowStarted(runId: string, organizationId: string) {
  // Sentry.captureMessage('proposal_workflow_created', { ... });
  logger.info('workflow.started', { workflow_run_id: runId, organization_id: organizationId });
}

export function recordWorkflowDecision(runId: string, decision: string) {
  logger.info('workflow.decision', { workflow_run_id: runId, decision });
}

export function recordWorkflowSent(runId: string, messageId: string | null, blocked: boolean) {
  const outcome = blocked ? 'blocked' : messageId ? 'sent' : 'failed';
  logger.info('workflow.sent', {
    workflow_run_id: runId,
    message_id: messageId,
    blocked,
    outcome,
  });
}

export function recordMetric(name: string, value: number, tags: Record<string, string>) {
  const tagStr = Object.entries(tags)
    .map(([k, v]) => `${k}:${v}`)
    .join(',');
  logger.info('workflow.metric', { metric_name: name, value, tags: tagStr });
}

export async function recordCheckpointPerformance(
  threadId: string,
  checkpointSizeBytes: number,
  resumeLatencyMs: number,
) {
  logger.info('workflow.checkpoint_perf', {
    thread_id: threadId,
    checkpoint_size_bytes: checkpointSizeBytes,
    resume_latency_ms: resumeLatencyMs,
  });
}
