import { normalizeLearningSignal, type LearningSignal, type LearningSignalKind } from '../flywheel/signals';

export type HermesRuntimeSource = 'native' | 'mastra';

export interface HermesRuntimeObservation {
  id: string;
  source: HermesRuntimeSource;
  organizationId: string;
  agentId: string;
  capabilityId: string;
  runId: string;
  traceId: string | null;
  eventKind: LearningSignalKind;
  failureClass: string;
  confidence: number;
  impact: number;
  evidenceRef: string;
  occurredAt: string;
  redactedSummary: string | null;
  missionId?: string;
  workflowId?: string;
  sessionId?: string;
  agentVersion?: string;
}

export function runtimeObservationToLearningSignal(observation: HermesRuntimeObservation): LearningSignal {
  if (!observation.organizationId || !observation.agentId || !observation.capabilityId) {
    throw new Error('hermes_runtime_scope_invalid');
  }
  if (!observation.runId || !observation.evidenceRef) {
    throw new Error('hermes_runtime_evidence_required');
  }

  return normalizeLearningSignal({
    id: observation.id,
    scope: {
      organizationId: observation.organizationId,
      agentId: observation.agentId,
      capabilityId: observation.capabilityId,
    },
    kind: observation.eventKind,
    failureClass: observation.failureClass || observation.eventKind,
    confidence: observation.confidence,
    impact: observation.impact,
    observedAt: observation.occurredAt,
    evidenceRef: observation.evidenceRef,
    redactedSummary: observation.redactedSummary,
    provenance: {
      missionId: observation.missionId,
      runId: observation.runId,
      workflowId: observation.workflowId,
      sessionId: observation.sessionId,
      traceId: observation.traceId ?? undefined,
      agentVersion: observation.agentVersion,
    },
  });
}
