import { describe, expect, it } from 'vitest';

import {
  nativeJobOutcomeToRuntimeObservation,
  runtimeObservationToLearningSignal,
} from '../hermes/runtime-events';

describe('Hermes runtime observation adapter', () => {
  it('normalizes native and Mastra observations through the same learning contract', () => {
    const base = {
      id: 'obs-1',
      organizationId: 'org-a',
      agentId: 'sales',
      capabilityId: 'reply',
      runId: 'run-1',
      missionId: null,
      workflowId: null,
      sessionId: null,
      traceId: 'trace-1',
      agentVersion: null,
      status: 'failed' as const,
      costCents: 2,
      latencyMs: 150,
      evidenceRefs: ['run:1/tool:2'],
      sanitizedFailureClass: 'timeout',
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

  it('adapts the durable job_queue terminal state and ignores tenant-like payload data', () => {
    const observation = nativeJobOutcomeToRuntimeObservation(
      {
        id: 'job-1',
        organization_id: 'org-a',
        kind: 'inbound_turn',
        status: 'dead',
        last_error: 'alice@example.com provider timed out',
        created_at: new Date('2026-09-13T00:00:00.000Z'),
        payload: { organization_id: 'org-evil' },
      },
      { organizationId: 'org-a', agentId: 'sales', capabilityId: 'inbound_turn' },
      '2026-09-13T00:00:01.000Z',
    );

    expect(observation.organizationId).toBe('org-a');
    expect(observation.status).toBe('failed');
    expect(observation.latencyMs).toBeNull();
    expect(observation.redactedSummary).not.toContain('alice@example.com');
    expect(runtimeObservationToLearningSignal(observation).kind).toBe('verification_failure');
  });

  it('rejects non-terminal jobs and tenant authority mismatch', () => {
    const base = {
      id: 'job-2',
      organization_id: 'org-a',
      kind: 'followup_turn' as const,
      status: 'running' as const,
      last_error: null,
      created_at: new Date('2026-09-13T00:00:00.000Z'),
      payload: {},
    };
    expect(() =>
      nativeJobOutcomeToRuntimeObservation(
        base,
        { organizationId: 'org-a', agentId: 'sales', capabilityId: 'followup_turn' },
      ),
    ).toThrow('hermes_runtime_job_not_terminal');
    expect(() =>
      nativeJobOutcomeToRuntimeObservation(
        { ...base, status: 'dead' },
        { organizationId: 'org-b', agentId: 'sales', capabilityId: 'followup_turn' },
      ),
    ).toThrow('hermes_runtime_tenant_authority_mismatch');
  });
});
