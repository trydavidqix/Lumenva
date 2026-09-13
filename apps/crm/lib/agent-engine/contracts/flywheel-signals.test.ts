import { describe, expect, it } from 'vitest';

import {
  learningSignalWeight,
  normalizeLearningSignal,
  type LearningSignalKind,
} from '../flywheel/signals';

const ALL_KINDS: LearningSignalKind[] = [
  'eval_failure',
  'shadow_failure',
  'human_approval',
  'human_rejection',
  'human_correction',
  'tool_failure',
  'provider_failure',
  'policy_escalation',
  'loop_stop',
  'cost_regression',
  'latency_regression',
  'verification_failure',
  'post_promotion_regression',
  'run_success',
  'business_outcome',
  'reviewer_finding',
  'capability_changed',
  'resource_regression',
];

function input(overrides: Record<string, unknown> = {}) {
  return {
    id: 'signal-1',
    scope: {
      organizationId: 'org-a',
      agentId: 'agent-a',
      capabilityId: 'crm.contact.update',
    },
    kind: 'tool_failure',
    failureClass: 'timeout',
    confidence: 0.8,
    impact: 0.6,
    observedAt: '2026-08-18T12:00:00.000Z',
    evidenceRef: 'run:run-1/tool:call-2',
    redactedSummary: 'tool timeout after retry budget',
    transcript: 'PII SHOULD NOT SURVIVE',
    body: 'raw customer message',
    ...overrides,
  };
}

describe('Phase 6 learning signal normalization', () => {
  it('supports every approved signal kind with a deterministic positive weight', () => {
    for (const kind of ALL_KINDS) {
      expect(learningSignalWeight(kind)).toBeGreaterThan(0);
      expect(normalizeLearningSignal(input({ kind })).kind).toBe(kind);
    }
  });

  it('creates a stable fingerprint from scope, kind and normalized failure class', () => {
    const a = normalizeLearningSignal(input({ failureClass: '  TIMEOUT  ' }));
    const b = normalizeLearningSignal(input({ id: 'signal-2', failureClass: 'timeout' }));
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('rejects confidence and impact outside zero-to-one', () => {
    expect(() => normalizeLearningSignal(input({ confidence: 1.01 }))).toThrow(
      'flywheel_signal_confidence_invalid',
    );
    expect(() => normalizeLearningSignal(input({ impact: -0.01 }))).toThrow(
      'flywheel_signal_impact_invalid',
    );
  });

  it('fails closed when tenant, agent or capability scope is missing', () => {
    expect(() =>
      normalizeLearningSignal(
        input({ scope: { organizationId: 'org-a', agentId: '', capabilityId: 'cap-1' } }),
      ),
    ).toThrow('flywheel_signal_scope_invalid');
  });

  it('keeps only privacy-safe evidence references and summaries', () => {
    const normalized = normalizeLearningSignal(input()) as unknown as Record<string, unknown>;
    expect(normalized.evidenceRef).toBe('run:run-1/tool:call-2');
    expect(normalized.redactedSummary).toBe('tool timeout after retry budget');
    expect(normalized.transcript).toBeUndefined();
    expect(normalized.body).toBeUndefined();
  });

  it('keeps optional trace provenance separate from trusted tenant scope', () => {
    const normalized = normalizeLearningSignal(
      input({
        provenance: {
          missionId: 'mission-1',
          runId: 'run-1',
          workflowId: 'workflow-1',
          sessionId: 'session-1',
          traceId: 'trace-1',
          agentVersion: 'v2',
          organizationId: 'org-b',
        },
      }),
    );

    expect(normalized.scope.organizationId).toBe('org-a');
    expect(normalized.provenance).toEqual({
      missionId: 'mission-1',
      runId: 'run-1',
      workflowId: 'workflow-1',
      sessionId: 'session-1',
      traceId: 'trace-1',
      agentVersion: 'v2',
    });
  });
});
