import { describe, expect, it } from 'vitest';

import { clusterLearningSignals } from '../flywheel/clustering';
import { normalizeLearningSignal } from '../flywheel/signals';

const NOW = Date.parse('2026-08-18T12:00:00.000Z');
const thresholds = {
  minOccurrences: 2,
  minConfidence: 0.7,
  windowMs: 60_000,
  minImpact: 0.5,
};

function signal(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return normalizeLearningSignal({
    id,
    scope: {
      organizationId: 'org-a',
      agentId: 'agent-a',
      capabilityId: 'crm.contact.update',
    },
    kind: 'tool_failure',
    failureClass: 'timeout',
    confidence: 0.9,
    impact: 0.8,
    observedAt: '2026-08-18T11:59:50.000Z',
    evidenceRef: `run:${id}`,
    redactedSummary: 'timeout',
    ...overrides,
  });
}

describe('Phase 6 learning clustering', () => {
  it('does not turn one-off noise into a cluster', () => {
    expect(clusterLearningSignals([signal('s1')], thresholds, NOW)).toEqual([]);
  });

  it('enforces occurrence, confidence, impact and time-window thresholds', () => {
    expect(
      clusterLearningSignals(
        [signal('s1'), signal('s2', { confidence: 0.2 })],
        thresholds,
        NOW,
      ),
    ).toEqual([]);
    expect(
      clusterLearningSignals(
        [signal('s1'), signal('s2', { impact: 0.1 })],
        thresholds,
        NOW,
      ),
    ).toEqual([]);
    expect(
      clusterLearningSignals(
        [
          signal('s1'),
          signal('s2', { observedAt: '2026-08-18T11:58:00.000Z' }),
        ],
        thresholds,
        NOW,
      ),
    ).toEqual([]);
  });

  it('never combines tenant, agent or capability mismatches', () => {
    const differentTenant = signal('s2', {
      scope: {
        organizationId: 'org-b',
        agentId: 'agent-a',
        capabilityId: 'crm.contact.update',
      },
    });
    expect(clusterLearningSignals([signal('s1'), differentTenant], thresholds, NOW)).toEqual([]);
  });

  it('produces stable deterministic clusters and sorted evidence refs', () => {
    const first = clusterLearningSignals([signal('s2'), signal('s1')], thresholds, NOW);
    const second = clusterLearningSignals([signal('s1'), signal('s2')], thresholds, NOW);
    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
    expect(first[0]?.occurrences).toBe(2);
    expect(first[0]?.signalRefs).toEqual(['run:s1', 'run:s2']);
    expect(first[0]?.scope.organizationId).toBe('org-a');
  });
});
