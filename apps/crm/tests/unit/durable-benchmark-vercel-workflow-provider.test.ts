import { describe, expect, it, vi } from 'vitest';

import { runVercelWorkflowPhase7Provider } from '@/lib/agent-engine/durable-benchmark/providers/vercel-workflow-provider';

const result = {
  terminalState: 'completed' as const,
  lifecycle: [{ seq: 1, kind: 'completed', atMs: 0, evidence: 'synthetic' }],
  retryCount: 0,
  approvalRequired: false,
  approvalSatisfied: false,
  resumedFromExpectedStep: true,
  effectAttempts: 1,
  committedEffects: 1,
  recoveredAfterCrash: false,
  crossTenantViolation: false,
  durationMs: 1,
  engineVersion: 'vercel-workflow-test',
};

describe('Phase 7 Vercel Workflow provider', () => {
  it('fails closed when no real isolated runtime is available', async () => {
    const report = await runVercelWorkflowPhase7Provider({});
    expect(report).toMatchObject({
      engineId: 'vercel_workflow',
      status: 'BLOCKED',
      realEvidence: false,
    });
    expect(report.score).toBeUndefined();
  });

  it('does not label an injected mock invocation as real provider evidence', async () => {
    const invoke = vi.fn().mockResolvedValue(result);
    const report = await runVercelWorkflowPhase7Provider({ invoke, realRuntime: false });
    expect(report.status).toBe('BLOCKED');
    expect(invoke).not.toHaveBeenCalled();
  });
});
