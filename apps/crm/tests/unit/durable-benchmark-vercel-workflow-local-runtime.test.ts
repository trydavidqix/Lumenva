import { describe, expect, it, vi } from 'vitest';

import { createVercelWorkflowLocalDispatcher } from '@/lib/agent-engine/durable-benchmark/adapters/vercel-workflow/local-dispatcher';

const completedOutput = {
  terminalState: 'completed' as const,
  lifecycle: [{ seq: 1, kind: 'completed', atMs: 0, evidence: 'workflow local evidence' }],
  retryCount: 0,
  approvalRequired: false,
  approvalSatisfied: false,
  resumedFromExpectedStep: true,
  effectAttempts: 1,
  committedEffects: 1,
  recoveredAfterCrash: false,
  crossTenantViolation: false,
  durationMs: 2,
  engineVersion: 'workflow-v4.8.0-local-world',
};

describe('Phase 7 Vercel Workflow local runtime dispatcher', () => {
  it('starts a canonical synthetic workflow run and polls its terminal output', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'wrun_123' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'running' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed', output: completedOutput }) });

    const dispatch = createVercelWorkflowLocalDispatcher({
      baseUrl: 'http://localhost:3000',
      fetchImpl,
      sleep: async () => undefined,
      maxPolls: 3,
    });

    const result = await dispatch({
      runId: 'vercel_workflow:small:happy_path:1',
      scenarioId: 'happy_path',
      scenarioVersion: '7.0.0',
      organizationId: 'bench-org-a',
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://localhost:3000/api/phase7/vercel-workflow');
    expect(fetchImpl.mock.calls[1]?.[0]).toBe('http://localhost:3000/api/phase7/vercel-workflow/wrun_123');
    expect(result).toMatchObject({ terminalState: 'completed', committedEffects: 1 });
  });

  it('retries approval delivery until the durable hook accepts it', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'wrun_approval' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'running' }) })
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ resumed: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'running' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ resumed: true }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'completed',
          output: {
            ...completedOutput,
            approvalRequired: true,
            approvalSatisfied: true,
            resumedFromExpectedStep: true,
          },
        }),
      });

    const dispatch = createVercelWorkflowLocalDispatcher({
      baseUrl: 'http://localhost:3000',
      fetchImpl,
      sleep: async () => undefined,
      maxPolls: 3,
      idFactory: () => 'delivery-group-1',
    });

    const result = await dispatch({
      runId: 'vercel_workflow:small:approval_pause_resume:1',
      scenarioId: 'approval_pause_resume',
      scenarioVersion: '7.0.0',
      organizationId: 'bench-org-a',
    });

    expect(fetchImpl.mock.calls[2]?.[0]).toBe('http://localhost:3000/api/phase7/vercel-workflow/approval');
    expect(fetchImpl.mock.calls[4]?.[0]).toBe('http://localhost:3000/api/phase7/vercel-workflow/approval');
    const approvalBody = JSON.parse(String(fetchImpl.mock.calls[4]?.[1]?.body)) as {
      runId: string;
      deliveryGroupId: string;
      approved: boolean;
    };
    expect(approvalBody).toEqual({
      runId: 'vercel_workflow:small:approval_pause_resume:1',
      deliveryGroupId: 'delivery-group-1',
      approved: true,
    });
    expect(result.approvalSatisfied).toBe(true);
  });

  it('aggregates duplicate deliveries into one committed synthetic effect', async () => {
    const duplicateOutput = { ...completedOutput, committedEffects: 0 };
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'wrun_primary' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'wrun_duplicate' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed', output: completedOutput }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed', output: duplicateOutput }) });

    const dispatch = createVercelWorkflowLocalDispatcher({
      baseUrl: 'http://localhost:3000',
      fetchImpl,
      sleep: async () => undefined,
      maxPolls: 1,
      idFactory: () => 'delivery-group-duplicate',
    });

    const result = await dispatch({
      runId: 'vercel_workflow:small:duplicate_delivery_idempotency:1',
      scenarioId: 'duplicate_delivery_idempotency',
      scenarioVersion: '7.0.0',
      organizationId: 'bench-org-a',
    });

    const firstBody = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { deliveryGroupId: string };
    const secondBody = JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body)) as { deliveryGroupId: string };
    expect(firstBody.deliveryGroupId).toBe('delivery-group-duplicate');
    expect(secondBody.deliveryGroupId).toBe('delivery-group-duplicate');
    expect(result.effectAttempts).toBe(2);
    expect(result.committedEffects).toBe(1);
  });

  it('fails closed for non-synthetic organizations before network access', async () => {
    const fetchImpl = vi.fn();
    const dispatch = createVercelWorkflowLocalDispatcher({
      baseUrl: 'http://localhost:3000',
      fetchImpl,
    });

    await expect(
      dispatch({
        runId: 'vercel_workflow:small:happy_path:2',
        scenarioId: 'happy_path',
        scenarioVersion: '7.0.0',
        organizationId: 'customer-org',
      }),
    ).rejects.toThrow(/synthetic/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
