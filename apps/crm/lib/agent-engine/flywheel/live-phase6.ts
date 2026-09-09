import type { LearningScope } from './contracts';
import { normalizeLearningSignal, type LearningSignal } from './signals';

export function buildPhase6MemoryHygieneSignal(input: {
  jobId: string;
  organizationId: string;
  scope: LearningScope;
}): LearningSignal {
  if (input.scope.organizationId !== input.organizationId) {
    throw new Error('flywheel_signal_scope_mismatch');
  }
  return normalizeLearningSignal({
    id: `live-memory-hygiene:${input.jobId}`,
    scope: input.scope,
    kind: 'eval_failure',
    confidence: 1,
    impact: 0.7,
    observedAt: new Date().toISOString(),
    evidenceRef: `flywheel_judge:${input.jobId}`,
    failureClass: 'memory_hygiene',
    redactedSummary: 'Recurring memory hygiene failure detected by the legacy judge.',
  });
}
