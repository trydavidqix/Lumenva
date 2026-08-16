/**
 * Task 3 Step 3: Proposal workflow metrics — Sentry + structured logging.
 */

/**
 * TODO Step 3.1: Sentry breadcrumbs
 * - workflow_run_id context
 * - humanDecision outcomes (approve/reject/edit)
 * - send results (sent/queued/blocked/failed)
 * - checkpoint resume events
 *
 * Example:
 * Sentry.captureMessage('proposal_workflow_created', {
 *   level: 'info',
 *   contexts: { workflow: { run_id, organization_id } }
 * });
 */
export function recordWorkflowStarted(runId: string, organizationId: string) {
  // TODO: Sentry breadcrumb + structured log
}

/**
 * TODO Step 3.2: Structured logging timeline
 * - draft → approve → send → completed
 * - Each step: timestamp, actor, duration, outcome
 *
 * Example:
 * logger.info('workflow.drafted', {
 *   workflow_run_id: runId,
 *   organization_id: orgId,
 *   duration_ms: Date.now() - startTime,
 *   draft_length: body.length
 * });
 */
export function recordWorkflowDecision(runId: string, decision: string) {
  // TODO: Structured log with decision outcome
}

export function recordWorkflowSent(runId: string, messageId: string | null, blocked: boolean) {
  // TODO: Structured log with send outcome (sent/blocked/failed)
}

/**
 * TODO Step 3.3: Metrics (counters + gauges)
 * - Workflow latency p50/p95/p99 (draft/approve/send)
 * - Send success rate (sent / total)
 * - Follow-up rate (scheduled / sent)
 * - Checkpoint resume latency
 *
 * Example (if using Prometheus-style client):
 * workflowLatency.observe(Date.now() - startTime, { stage: 'approve' });
 * sendSuccessCounter.inc({ organization_id: orgId, result: 'sent' });
 */
export function recordMetric(name: string, value: number, tags: Record<string, string>) {
  // TODO: Push to metrics backend (Datadog, New Relic, etc.)
}

/**
 * TODO Step 3.4: Checkpoint performance
 * - Query langgraph_internal.checkpoints
 * - Measure resume latency (now - checkpoint created_at)
 * - Track checkpoint size per workflow_type
 * - Monitor checkpoint write latency
 */
export async function recordCheckpointPerformance(
  threadId: string,
  checkpointSizeBytes: number,
  resumeLatencyMs: number,
) {
  // TODO: Query checkpoint table, emit performance metrics
}
