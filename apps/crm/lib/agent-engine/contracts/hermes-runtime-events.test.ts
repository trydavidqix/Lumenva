import { describe, expect, it } from 'vitest';

import { runtimeObservationToLearningSignal } from '../hermes/runtime-events';

describe('Hermes runtime observation adapter', () => {
  it('normalizes native and Mastra observations through the same learning contract', () => {
    const base = {
      id: 'obs-1',
      organizationId: 'org-a',
      agentId: 'sales',
      capabilityId: 'reply',
      runId: 'run-1',
      traceId: 'trace-1',
      eventKind: 'tool_failure' as const,
      failureClass: 'timeout',
      confidence: 0.9,
      impact: 0.8,
      evidenceRef: 'run:1/tool:2',
      occurredAt: '2026-09-13T00:00:00.000Z',
      redactedSummary: 'alice@example.com timed out',
    };

    const native = runtimeObservationToLearningSignal({ ...base, source: 'native' });
    const mastra = runtimeObservationToLearningSignal({ ...base, id: 'obs-2', source: 'mastra' });

    expect(native.fingerprint).toBe(mastra.fingerprint);
    expect(native.scope.organizationId).toBe('org-a');
    expect(native.redactedSummary).not.toContain('alice@example.com');
    expect(native.provenance?.runId).toBe('run-1');
  });
});
