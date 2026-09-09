import { describe, expect, it, vi } from 'vitest';

import type { PromotionDecision } from '../autonomy/promotion';
import { executeThroughToolGateway } from '../tools/gateway';
import type { AgentToolDefinition } from '../tools/registry';

function tool(risk: AgentToolDefinition['risk']): AgentToolDefinition {
  const hasSideEffect = risk !== 'r0_read';
  return {
    id: `tool.${risk}`,
    owner: 'agent-engine.test',
    source: 'internal',
    schema: { kind: 'inline', value: {} },
    risk,
    hasSideEffect,
    idempotencyRequired: hasSideEffect,
    timeoutMs: 1_000,
    maxRetries: 0,
  };
}

const promoted: PromotionDecision = { kind: 'allow', evidenceRef: 'eval-1' };

function input(
  risk: AgentToolDefinition['risk'],
  promotionDecision: PromotionDecision | undefined,
  execute = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: true }),
) {
  return {
    organizationId: 'org-a',
    agentId: 'agent-a',
    runId: 'run-a',
    autonomyLevel: 'assisted' as const,
    tool: tool(risk),
    args: {},
    idempotencyKey: `idem-${risk}`,
    execute,
    approvalStore: {
      save: vi.fn(),
      load: vi.fn(),
    },
    promotionDecision,
  };
}

describe('ASSISTED risk semantics', () => {
  it('allows R0 without promotion evidence when policy permits', async () => {
    const execute = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: true });
    const result = await executeThroughToolGateway(input('r0_read', undefined, execute));
    expect(result).toEqual({ kind: 'executed', result: { ok: true } });
    expect(execute).toHaveBeenCalledOnce();
  });

  it('denies R1 when valid promotion evidence is absent', async () => {
    const execute = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: true });
    const result = await executeThroughToolGateway(input('r1_reversible_write', undefined, execute));
    expect(result).toEqual({ kind: 'denied', reason: 'promotion_evidence_required' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('allows R1 exactly when promotion gate allowed it', async () => {
    const execute = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: true });
    const result = await executeThroughToolGateway(input('r1_reversible_write', promoted, execute));
    expect(result).toEqual({ kind: 'executed', result: { ok: true } });
    expect(execute).toHaveBeenCalledOnce();
  });

  it('keeps R2 approval controlled', async () => {
    const result = await executeThroughToolGateway(input('r2_external_communication', promoted));
    expect(result.kind).toBe('pending_approval');
  });

  it('keeps R3 behind explicit durable approval', async () => {
    const result = await executeThroughToolGateway(input('r3_sensitive_commercial', promoted));
    expect(result.kind).toBe('pending_approval');
  });

  it('denies R4 even with valid promotion evidence', async () => {
    const execute = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: true });
    const result = await executeThroughToolGateway(input('r4_destructive_admin', promoted, execute));
    expect(result).toEqual({ kind: 'denied', reason: 'r4_requires_human' });
    expect(execute).not.toHaveBeenCalled();
  });
});
