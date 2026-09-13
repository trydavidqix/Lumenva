import type { JobRow } from '../queue/queue';
import { normalizeLearningSignal, type LearningSignal, type LearningSignalKind } from '../flywheel/signals';
import { sanitizeLearningSummary } from './sanitization';

export type HermesRuntimeSource = 'native' | 'mastra' | 'external';
export type HermesRuntimeStatus = 'succeeded' | 'failed' | 'blocked' | 'cancelled';

/**
 * Provider-neutral runtime observation. Scope fields must come from trusted runtime
 * state, never from model/tool payloads. The legacy signal-oriented fields remain
 * optional so the first Hermes branch callers stay source-compatible.
 */
export interface HermesRuntimeObservation {
  id: string;
  source: HermesRuntimeSource;
  organizationId: string;
  agentId: string;
  capabilityId: string;
  runId: string;
  missionId: string | null;
  workflowId: string | null;
  sessionId: string | null;
  traceId: string | null;
  agentVersion: string | null;
  status: HermesRuntimeStatus;
  costCents: number | null;
  latencyMs: number | null;
  evidenceRefs: string[];
  sanitizedFailureClass: string | null;
  occurredAt: string;
  redactedSummary: string | null;
  eventKind?: LearningSignalKind;
  failureClass?: string;
  confidence?: number;
  impact?: number;
  evidenceRef?: string;
}

function statusToSignalKind(status: HermesRuntimeStatus): LearningSignalKind {
  if (status === 'succeeded') return 'run_success';
  if (status === 'blocked') return 'policy_escalation';
  if (status === 'cancelled') return 'loop_stop';
  return 'verification_failure';
}

function defaultFailureClass(observation: HermesRuntimeObservation): string {
  if (observation.failureClass?.trim()) return observation.failureClass;
  if (observation.sanitizedFailureClass?.trim()) return observation.sanitizedFailureClass;
  return observation.status === 'succeeded' ? 'runtime_success' : `runtime_${observation.status}`;
}

function defaultImpact(status: HermesRuntimeStatus): number {
  return status === 'succeeded' ? 0.25 : status === 'cancelled' ? 0.45 : 0.8;
}

export function runtimeObservationToLearningSignal(observation: HermesRuntimeObservation): LearningSignal {
  if (!observation.organizationId || !observation.agentId || !observation.capabilityId) {
    throw new Error('hermes_runtime_scope_invalid');
  }
  if (!observation.runId || observation.evidenceRefs.length === 0) {
    throw new Error('hermes_runtime_evidence_required');
  }
  if (observation.costCents !== null && (!Number.isFinite(observation.costCents) || observation.costCents < 0)) {
    throw new Error('hermes_runtime_cost_invalid');
  }
  if (observation.latencyMs !== null && (!Number.isFinite(observation.latencyMs) || observation.latencyMs < 0)) {
    throw new Error('hermes_runtime_latency_invalid');
  }

  const evidenceRef = observation.evidenceRef?.trim() || observation.evidenceRefs[0];
  if (!evidenceRef) throw new Error('hermes_runtime_evidence_required');

  return normalizeLearningSignal({
    id: observation.id,
    scope: {
      organizationId: observation.organizationId,
      agentId: observation.agentId,
      capabilityId: observation.capabilityId,
    },
    kind: observation.eventKind ?? statusToSignalKind(observation.status),
    failureClass: defaultFailureClass(observation),
    confidence: observation.confidence ?? 1,
    impact: observation.impact ?? defaultImpact(observation.status),
    observedAt: observation.occurredAt,
    evidenceRef,
    redactedSummary: observation.redactedSummary,
    provenance: {
      missionId: observation.missionId ?? undefined,
      runId: observation.runId,
      workflowId: observation.workflowId ?? undefined,
      sessionId: observation.sessionId ?? undefined,
      traceId: observation.traceId ?? undefined,
      agentVersion: observation.agentVersion ?? undefined,
    },
  });
}

export interface NativeJobObservationScope {
  /** Trusted tenant authority from the claimed job row / DB, never request payload. */
  organizationId: string;
  agentId: string;
  capabilityId: string;
}

/**
 * Adapts the durable worker completion/error boundary (`job_queue`) into Hermes.
 * `job.payload.organization_id` is intentionally ignored even if present.
 * `latencyMs` stays null because job_queue has no durable terminal timestamp; we
 * do not invent precision from `created_at` and observation time.
 */
export function nativeJobOutcomeToRuntimeObservation(
  job: Pick<
    JobRow,
    'id' | 'organization_id' | 'kind' | 'status' | 'last_error' | 'created_at' | 'payload'
  >,
  scope: NativeJobObservationScope,
  observedAt = new Date().toISOString(),
): HermesRuntimeObservation {
  if (!scope.organizationId || scope.organizationId !== job.organization_id) {
    throw new Error('hermes_runtime_tenant_authority_mismatch');
  }
  if (!scope.agentId || !scope.capabilityId) throw new Error('hermes_runtime_scope_invalid');
  if (!['done', 'failed', 'dead'].includes(job.status)) {
    throw new Error('hermes_runtime_job_not_terminal');
  }

  const status: HermesRuntimeStatus = job.status === 'done' ? 'succeeded' : 'failed';
  const failureClass = status === 'failed'
    ? sanitizeLearningSummary(job.last_error)?.slice(0, 80).replace(/\s+/g, '_').toLowerCase() || 'runtime_failed'
    : null;

  return {
    id: `native-job:${job.id}:${job.status}`,
    source: 'native',
    organizationId: scope.organizationId,
    agentId: scope.agentId,
    capabilityId: scope.capabilityId,
    runId: job.id,
    missionId: null,
    workflowId: job.kind,
    sessionId: null,
    traceId: null,
    agentVersion: null,
    status,
    costCents: null,
    latencyMs: null,
    evidenceRefs: [`job_queue:${job.id}`],
    sanitizedFailureClass: failureClass,
    occurredAt: observedAt,
    redactedSummary: status === 'failed' ? sanitizeLearningSummary(job.last_error) : `native ${job.kind} completed`,
  };
}
