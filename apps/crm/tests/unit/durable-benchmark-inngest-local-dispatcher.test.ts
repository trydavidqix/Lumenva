import { describe, expect, it, vi } from 'vitest';

import { createInngestLocalDispatcher } from '@/lib/agent-engine/durable-benchmark/adapters/inngest/local-dispatcher';

const output = {
  terminalState: 'completed',
  lifecycle: [{ seq: 1, kind: 'completed', atMs: 0, evidence: 'synthetic evidence' }],
  retryCount: 0,
  approvalRequired: false,
  approvalSatisfied: false,
  resumedFromExpectedStep: true,
  effectAttempts: 1,
  committedEffects: 1,
  recoveredAfterCrash: false,
  crossTenantViolation: false,
  durationMs: 42,
  engineVersion: 'inngest-test',
  providerPayload: { authorization: 'Bearer secret' },
};

describe('Phase 7 Inngest local dispatcher', () => {
  it('polls the official v2 event-runs endpoint with output enabled and returns sanitized hard-gate data', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ids: ['evt_123'], status: 200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'run_123', status: 'COMPLETED', output }] }),
      });

    const dispatch = createInngestLocalDispatcher({
      baseUrl: 'http://localhost:8288',
      fetchImpl,
      sleep: async () => undefined,
    });

    const result = await dispatch({
      runId: 'phase7:small:happy_path:1',
      scenarioId: 'happy_path',
      scenarioVersion: '7.0.0',
      organizationId: 'bench-org-a',
      profile: 'small',
      attempt: 1,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      'http://localhost:8288/api/v2/events/evt_123/runs?includeOutput=true',
    );
    expect(result.terminalState).toBe('completed');
    expect(result.durationMs).toBe(42);
    expect(result.lifecycle).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('Bearer secret');
    expect(JSON.stringify(result)).not.toContain('authorization');
  });

  it('sends approval only after the run is observable and retries the signal while the run remains nonterminal', async () => {
    const approvedOutput = {
      ...output,
      approvalRequired: true,
      approvalSatisfied: true,
      resumedFromExpectedStep: true,
    };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ids: ['evt_approval'], status: 200 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'run_approval', status: 'RUNNING' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ids: ['approval_evt_1'], status: 200 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'run_approval', status: 'RUNNING' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ids: ['approval_evt_2'], status: 200 }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'run_approval', status: 'COMPLETED', output: approvedOutput }] }),
      });

    const dispatch = createInngestLocalDispatcher({
      baseUrl: 'http://localhost:8288',
      fetchImpl,
      sleep: async () => undefined,
      maxPolls: 5,
    });

    const result = await dispatch({
      runId: 'phase7:small:approval_pause_resume:1',
      scenarioId: 'approval_pause_resume',
      scenarioVersion: '7.0.0',
      organizationId: 'bench-org-a',
      profile: 'small',
      attempt: 1,
    });

    const calls = fetchImpl.mock.calls;
    expect(calls[1]?.[0]).toContain('/events/evt_approval/runs?includeOutput=true');
    expect(calls[2]?.[0]).toContain('/events/evt_approval/runs?includeOutput=true');
    expect(calls[3]?.[0]).toBe('http://localhost:8288/e/phase7-local-key');
    expect(calls[5]?.[0]).toBe('http://localhost:8288/e/phase7-local-key');
    expect(JSON.parse(String(calls[3]?.[1]?.body)).data).toMatchObject({
      runId: 'phase7:small:approval_pause_resume:1',
      approved: true,
    });
    expect(result.terminalState).toBe('completed');
    expect(result.approvalSatisfied).toBe(true);
  });

  it('sends duplicate-delivery as a second provider event with a different event id but the same run id', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ids: ['evt_primary'], status: 200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ids: ['evt_duplicate'], status: 200 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'run_123', status: 'COMPLETED', output: { ...output, effectAttempts: 2 } }] }),
      });

    const dispatch = createInngestLocalDispatcher({
      baseUrl: 'http://localhost:8288',
      fetchImpl,
      sleep: async () => undefined,
    });

    const result = await dispatch({
      runId: 'phase7:medium:duplicate_delivery_idempotency:1',
      scenarioId: 'duplicate_delivery_idempotency',
      scenarioVersion: '7.0.0',
      organizationId: 'bench-org-a',
      profile: 'medium',
      attempt: 1,
    });

    const primary = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { id: string; data: { runId: string } };
    const duplicate = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body)) as { id: string; data: { runId: string } };
    expect(primary.id).not.toBe(duplicate.id);
    expect(primary.data.runId).toBe(duplicate.data.runId);
    expect(fetchImpl.mock.calls[2]?.[0]).toContain('/events/evt_primary/runs?includeOutput=true');
    expect(fetchImpl.mock.calls[3]?.[0]).toContain('/events/evt_duplicate/runs?includeOutput=true');
    expect(result.terminalState).toBe('completed');
    expect(result.effectAttempts).toBe(2);
    expect(result.committedEffects).toBe(1);
  });

  it('fails closed before any network request for non-synthetic organizations', async () => {
    const fetchImpl = vi.fn();
    const dispatch = createInngestLocalDispatcher({
      baseUrl: 'http://localhost:8288',
      fetchImpl,
      sleep: async () => undefined,
    });

    await expect(
      dispatch({
        runId: 'phase7:small:happy_path:2',
        scenarioId: 'happy_path',
        scenarioVersion: '7.0.0',
        organizationId: 'customer-org',
        profile: 'small',
        attempt: 1,
      }),
    ).rejects.toThrow(/synthetic/i);

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
