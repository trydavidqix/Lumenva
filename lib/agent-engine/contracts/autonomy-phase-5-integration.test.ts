import { describe, expect, it, vi } from 'vitest';

import { authorizeAutonomyPromotion, evaluateAutonomyPromotion } from '../autonomy/promotion';
import {
  createApprovalRequest,
  decideApprovalRequest,
  enforceApprovalDecision,
  type ApprovalRequest,
  type ApprovalStore,
} from '../policies/approval';
import { executeThroughToolGateway } from '../tools/gateway';
import type { AgentToolDefinition } from '../tools/registry';

function tool(id: string, risk: AgentToolDefinition['risk']): AgentToolDefinition {
  return {
    id,
    owner: 'agent-engine.phase-5-test',
    source: 'internal',
    schema: { kind: 'inline', value: {} },
    risk,
    hasSideEffect: risk !== 'r0_read',
    idempotencyRequired: risk !== 'r0_read',
    timeoutMs: 10_000,
    maxRetries: 0,
  };
}

const r1 = tool('crm.contact.update', 'r1_reversible_write');
const r2 = tool('crm.message.send', 'r2_external_communication');
const r3 = tool('crm.deal.discount', 'r3_sensitive_commercial');
const r4 = tool('admin.destroy', 'r4_destructive_admin');

function store(): ApprovalStore {
  const rows = new Map<string, ApprovalRequest>();
  return {
    async save(value) { rows.set(value.id, structuredClone(value)); },
    async load(id) { const value = rows.get(id); return value ? structuredClone(value) : null; },
  };
}

const evidence = {
  ref: 'phase5-eval-green',
  observedAt: '2026-08-18T10:00:00.000Z',
  policyCompliance: 1,
  failureRate: 0,
  loopStopRate: 0,
  p95LatencyMs: 500,
  avgCostCents: 1,
};
const thresholds = {
  maxEvidenceAgeMs: 86_400_000,
  minPolicyCompliance: 0.99,
  maxFailureRate: 0.01,
  maxLoopStopRate: 0.01,
};

describe('Agent OS Phase 5 end-to-end release gate', () => {
  it('promotes only one governed step at a time with fresh eval evidence', () => {
    const gate = evaluateAutonomyPromotion({
      evidence,
      nowMs: Date.parse('2026-08-18T10:30:00.000Z'),
      thresholds,
    });
    expect(gate).toEqual({ kind: 'allow', evidenceRef: evidence.ref });
    expect(authorizeAutonomyPromotion({ actor: 'human', currentLevel: 'shadow', desiredLevel: 'draft', promotionDecision: gate }))
      .toEqual({ kind: 'allow', evidenceRef: evidence.ref });
    expect(authorizeAutonomyPromotion({ actor: 'human', currentLevel: 'draft', desiredLevel: 'assisted', promotionDecision: gate }))
      .toEqual({ kind: 'allow', evidenceRef: evidence.ref });
    expect(authorizeAutonomyPromotion({ actor: 'model', currentLevel: 'draft', desiredLevel: 'assisted', promotionDecision: gate }))
      .toEqual({ kind: 'deny', reason: 'model_cannot_promote' });
  });

  it('keeps SHADOW and DRAFT side-effect free', async () => {
    for (const autonomyLevel of ['shadow', 'draft'] as const) {
      const execute = vi.fn();
      const result = await executeThroughToolGateway({
        organizationId: 'org-a', agentId: 'agent-a', autonomyLevel,
        tool: r1, args: { x: 1 }, idempotencyKey: `idem-${autonomyLevel}`, execute, approvalStore: null,
      });
      expect(execute).not.toHaveBeenCalled();
      expect(['denied', 'draft']).toContain(result.kind);
    }
  });

  it('executes ASSISTED R1 only with valid promotion evidence and emits audit evidence', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true });
    const recorder = { record: vi.fn().mockResolvedValue(undefined) };
    const result = await executeThroughToolGateway({
      organizationId: 'org-a', agentId: 'agent-a', runId: 'run-r1', traceId: 'trace-r1', correlationId: 'corr-r1',
      autonomyLevel: 'assisted', promotionDecision: { kind: 'allow', evidenceRef: evidence.ref },
      autonomyEvidenceRecorder: recorder,
      tool: r1, args: {}, idempotencyKey: 'r1-key', execute, approvalStore: null,
    });
    expect(result).toEqual({ kind: 'executed', result: { ok: true } });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(recorder.record).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run-r1', traceId: 'trace-r1', kind: 'autonomy_decision',
      payload: expect.objectContaining({
        capabilityId: r1.id,
        autonomyLevel: 'assisted',
        riskTier: 'r1_reversible_write',
        promotionEvidenceRef: evidence.ref,
        policyOutcome: 'allow',
        executionOutcome: 'executed',
      }),
    }));
  });

  it('keeps R2 and R3 behind durable approval and R4 denied', async () => {
    for (const toolDefinition of [r2, r3]) {
      const approvals = store();
      const result = await executeThroughToolGateway({
        organizationId: 'org-a', agentId: 'agent-a', runId: `run-${toolDefinition.id}`,
        autonomyLevel: 'assisted', promotionDecision: { kind: 'allow', evidenceRef: evidence.ref },
        tool: toolDefinition, args: {}, idempotencyKey: `key-${toolDefinition.id}`, execute: vi.fn(), approvalStore: approvals,
      });
      expect(result.kind).toBe('pending_approval');
    }

    const destructive = vi.fn();
    expect(await executeThroughToolGateway({
      organizationId: 'org-a', agentId: 'agent-a', autonomyLevel: 'assisted',
      promotionDecision: { kind: 'allow', evidenceRef: evidence.ref },
      tool: r4, args: {}, idempotencyKey: 'r4-key', execute: destructive, approvalStore: null,
    })).toEqual({ kind: 'denied', reason: 'r4_requires_human' });
    expect(destructive).not.toHaveBeenCalled();
  });

  it('resumes an approved action exactly once with the original idempotency identity', async () => {
    const approvals = store();
    const request = await createApprovalRequest(approvals, {
      organizationId: 'org-a', runId: 'run-resume', agentId: 'agent-a', toolId: r3.id,
      approvalType: 'sensitive_commercial', idempotencyKey: 'stable-resume-key', reason: 'required',
    });
    await decideApprovalRequest(approvals, request.id,
      { decision: 'approved', decidedBy: 'human' },
      { organizationId: 'org-a', runTerminal: false },
    );
    const execute = vi.fn().mockResolvedValue({ ok: true });
    expect(await enforceApprovalDecision(approvals, request.id, execute, { organizationId: 'org-a' })).toEqual({ kind: 'executed', result: { ok: true } });
    expect(await enforceApprovalDecision(approvals, request.id, execute, { organizationId: 'org-a' })).toEqual({ kind: 'already_executed' });
    expect(execute).toHaveBeenCalledTimes(1);
    expect((await approvals.load(request.id))?.idempotencyKey).toBe('stable-resume-key');
  });

  it('applies runtime rollback without restart and keeps customer autopilot disabled', async () => {
    const execute = vi.fn();
    const rolledBack = await executeThroughToolGateway({
      organizationId: 'org-a', agentId: 'agent-a', autonomyLevel: 'assisted',
      promotionDecision: { kind: 'allow', evidenceRef: evidence.ref },
      runtimeAutonomyResolver: { async resolve() { return {
        level: 'draft', globalEnabled: true, tenantEnabled: true, agentEnabled: true, capabilityEnabled: true,
      }; } },
      tool: r1, args: {}, idempotencyKey: 'rollback-key', execute, approvalStore: null,
    });
    expect(rolledBack.kind).toBe('draft');
    expect(execute).not.toHaveBeenCalled();
    expect(authorizeAutonomyPromotion({
      actor: 'human', currentLevel: 'assisted', desiredLevel: 'autopilot_low_risk',
      promotionDecision: { kind: 'allow', evidenceRef: evidence.ref },
    })).toEqual({ kind: 'deny', reason: 'phase5_autopilot_disabled' });
  });
});
