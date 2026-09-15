import { describe, expect, it, vi } from 'vitest';

import {
  authorizeAutonomyPromotion,
  evaluateAutonomyPromotion,
} from '../autonomy/promotion';
import { createCapabilityRiskRegistry, requireCapabilityRisk } from '../autonomy/risk-registry';
import {
  createApprovalRequest,
  decideApprovalRequest,
  enforceApprovalDecision,
  type ApprovalRequest,
  type ApprovalStore,
} from '../policies/approval';
import { executeThroughToolGateway } from '../tools/gateway';
import type { AgentToolDefinition } from '../tools/registry';
import type { AuthorizeModuleInput, ModuleRiskTier } from '../../entitlements/authorize-module';

function entitlementFor(toolDefinition: AgentToolDefinition, requestId: string): AuthorizeModuleInput {
  const risk: ModuleRiskTier = ({
    r0_read: 'P0', r1_reversible_write: 'P1', r2_external_communication: 'P2', r3_sensitive_commercial: 'P3', r4_destructive_admin: 'P4',
  } as const)[toolDefinition.risk];
  return {
    requestId, policyVersion: 'entitlements.v1',
    module: { id: toolDefinition.id, version: '1.0.0', dependencies: [], conflicts: [], requiredCapabilities: [], allowedRoles: ['agent'], risk, requiresApproval: false },
    tenant: { organizationId: 'org-a', rlsOrganizationId: 'org-a', rlsAllowed: true, plan: 'test', entitledModules: [toolDefinition.id] },
    actor: { actorId: 'agent-a', organizationId: 'org-a', role: 'agent', capabilities: [] }, enabledModules: [], maxRisk: 'P4', approval: { required: false, approved: false },
  };
}

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
const r4 = tool('admin.destroy', 'r4_destructive_admin');

function approvalStore(): ApprovalStore {
  const rows = new Map<string, ApprovalRequest>();
  return {
    async save(value) { rows.set(value.id, structuredClone(value)); },
    async load(id) { const value = rows.get(id); return value ? structuredClone(value) : null; },
    async compareAndSet(id, expectedStatus, next) {
      const current = rows.get(id);
      if (!current || current.status !== expectedStatus) return false;
      rows.set(id, structuredClone(next));
      return true;
    },
  };
}

describe('Phase 5 autonomy adversarial matrix', () => {
  it('denies stale evaluation evidence', () => {
    expect(evaluateAutonomyPromotion({
      evidence: {
        ref: 'old', observedAt: '2026-08-01T00:00:00.000Z', policyCompliance: 1,
        failureRate: 0, loopStopRate: 0, p95LatencyMs: 10, avgCostCents: 1,
      },
      nowMs: Date.parse('2026-08-18T00:00:00.000Z'),
      thresholds: { maxEvidenceAgeMs: 86_400_000, minPolicyCompliance: 1, maxFailureRate: 0.01, maxLoopStopRate: 0.01 },
    })).toEqual({ kind: 'deny', reason: 'stale_evidence' });
  });

  it('denies a model attempting to promote its own autonomy', () => {
    expect(authorizeAutonomyPromotion({
      actor: 'model',
      currentLevel: 'draft',
      desiredLevel: 'assisted',
      promotionDecision: { kind: 'allow', evidenceRef: 'eval-good' },
    })).toEqual({ kind: 'deny', reason: 'model_cannot_promote' });
  });

  it('denies malformed level jumps even with valid evidence', () => {
    expect(authorizeAutonomyPromotion({
      actor: 'human',
      currentLevel: 'shadow',
      desiredLevel: 'assisted',
      promotionDecision: { kind: 'allow', evidenceRef: 'eval-good' },
    })).toEqual({ kind: 'deny', reason: 'invalid_promotion_transition' });
  });

  it('keeps customer-facing autopilot disabled in Phase 5', () => {
    expect(authorizeAutonomyPromotion({
      actor: 'human',
      currentLevel: 'assisted',
      desiredLevel: 'autopilot_low_risk',
      promotionDecision: { kind: 'allow', evidenceRef: 'eval-good' },
    })).toEqual({ kind: 'deny', reason: 'phase5_autopilot_disabled' });
  });

  it('fails closed for an unknown capability', () => {
    const registry = createCapabilityRiskRegistry([r1]);
    expect(() => requireCapabilityRisk(registry, 'forged.tool')).toThrow('unknown_capability:forged.tool');
  });

  it('denies R4 autonomous execution', async () => {
    const execute = vi.fn();
    const result = await executeThroughToolGateway({
      organizationId: 'org-a', agentId: 'agent-a', autonomyLevel: 'assisted',
      promotionDecision: { kind: 'allow', evidenceRef: 'eval-good' },
      tool: r4, args: {}, idempotencyKey: 'r4-1', execute, approvalStore: null,
      entitlement: entitlementFor(r4, 'r4-1'),
    });
    expect(result).toEqual({ kind: 'denied', reason: 'r4_requires_human' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('honors a global kill switch immediately before execution', async () => {
    const execute = vi.fn();
    const result = await executeThroughToolGateway({
      organizationId: 'org-a', agentId: 'agent-a', autonomyLevel: 'assisted',
      promotionDecision: { kind: 'allow', evidenceRef: 'eval-good' },
      runtimeAutonomyResolver: { async resolve() { return {
        level: 'assisted', globalEnabled: false, tenantEnabled: true, agentEnabled: true, capabilityEnabled: true,
      }; } },
      tool: r1, args: {}, idempotencyKey: 'kill-1', execute, approvalStore: null,
      entitlement: entitlementFor(r1, 'kill-1'),
    });
    expect(result).toEqual({ kind: 'denied', reason: 'global_kill_switch' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('fails closed on forged cross-tenant approval access', async () => {
    const store = approvalStore();
    const request = await createApprovalRequest(store, {
      organizationId: 'org-a', runId: 'run-a', agentId: 'agent-a', toolId: r1.id,
      approvalType: 'tool_execution', idempotencyKey: 'approval-1', reason: 'required',
    });
    await expect(decideApprovalRequest(store, request.id,
      { decision: 'approved', decidedBy: 'attacker' },
      { organizationId: 'org-b', runTerminal: false },
    )).rejects.toThrow('approval_tenant_mismatch');
  });

  it('does not replay an approved side effect', async () => {
    const store = approvalStore();
    const request = await createApprovalRequest(store, {
      organizationId: 'org-a', runId: 'run-a', agentId: 'agent-a', toolId: r1.id,
      approvalType: 'tool_execution', idempotencyKey: 'stable-key', reason: 'required',
    });
    await decideApprovalRequest(store, request.id,
      { decision: 'approved', decidedBy: 'human' },
      { organizationId: 'org-a', runTerminal: false },
    );
    const execute = vi.fn().mockResolvedValue('ok');
    expect(await enforceApprovalDecision(store, request.id, execute, { organizationId: 'org-a' }))
      .toEqual({ kind: 'executed', result: 'ok' });
    expect(await enforceApprovalDecision(store, request.id, execute, { organizationId: 'org-a' }))
      .toEqual({ kind: 'already_executed' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('records a complete evidence envelope for a rollback denial', async () => {
    const recorder = { record: vi.fn().mockResolvedValue(undefined) };
    const result = await executeThroughToolGateway({
      organizationId: 'org-a', agentId: 'agent-a', runId: 'run-e', traceId: 'trace-e', correlationId: 'corr-e',
      autonomyLevel: 'assisted', promotionDecision: { kind: 'allow', evidenceRef: 'eval-good' },
      runtimeAutonomyResolver: { async resolve() { return {
        level: 'assisted', globalEnabled: true, tenantEnabled: true, agentEnabled: true, capabilityEnabled: false,
      }; } },
      autonomyEvidenceRecorder: recorder,
      tool: r1, args: {}, idempotencyKey: 'e-1', execute: vi.fn(), approvalStore: null,
      entitlement: entitlementFor(r1, 'e-1'),
    });
    expect(result).toEqual({ kind: 'denied', reason: 'capability_kill_switch' });
    expect(recorder.record).toHaveBeenCalledWith({
      runId: 'run-e', traceId: 'trace-e', kind: 'autonomy_decision',
      payload: {
        organizationId: 'org-a', agentId: 'agent-a', runId: 'run-e', capabilityId: r1.id,
        autonomyLevel: 'off', riskTier: 'r1_reversible_write', promotionEvidenceRef: 'eval-good',
        policyOutcome: 'deny', approvalId: null, approvalStatus: null,
        executionOutcome: 'capability_kill_switch', traceId: 'trace-e', correlationId: 'corr-e',
      },
    });
  });
});
