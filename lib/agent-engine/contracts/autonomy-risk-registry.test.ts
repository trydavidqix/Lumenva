import { describe, expect, it } from 'vitest';

import {
  createCapabilityRiskRegistry,
  requireCapabilityRisk,
} from '../autonomy/risk-registry';
import type { AgentToolDefinition } from '../tools/registry';

function tool(
  id: string,
  risk: AgentToolDefinition['risk'],
): AgentToolDefinition {
  const hasSideEffect = risk !== 'r0_read';
  return {
    id,
    owner: 'test',
    source: 'internal',
    schema: { kind: 'inline', value: {} },
    risk,
    hasSideEffect,
    idempotencyRequired: hasSideEffect,
    timeoutMs: 1_000,
    maxRetries: 0,
  };
}

describe('CapabilityRiskRegistry', () => {
  it('returns the canonical risk and side-effect metadata for a capability', () => {
    const registry = createCapabilityRiskRegistry([
      tool('crm.lead.read', 'r0_read'),
      tool('crm.lead.update', 'r1_reversible_write'),
    ]);

    expect(registry.get('crm.lead.update')).toEqual({
      capabilityId: 'crm.lead.update',
      risk: 'r1_reversible_write',
      hasSideEffect: true,
    });
  });

  it('returns null for an unknown capability', () => {
    const registry = createCapabilityRiskRegistry([]);
    expect(registry.get('unknown.capability')).toBeNull();
  });

  it('fails closed when a caller requests risk for an unknown side-effect capability', () => {
    const registry = createCapabilityRiskRegistry([]);
    expect(() => requireCapabilityRisk(registry, 'unknown.capability')).toThrow(
      'unknown_capability:unknown.capability',
    );
  });

  it('ignores caller-claimed promotion risk and keeps registry ownership', () => {
    const registry = createCapabilityRiskRegistry([
      tool('crm.discount.apply', 'r3_sensitive_commercial'),
    ]);
    const promotionPayload = {
      capabilityId: 'crm.discount.apply',
      claimedRisk: 'r0_read',
    } as const;

    expect(requireCapabilityRisk(registry, promotionPayload.capabilityId).risk).toBe(
      'r3_sensitive_commercial',
    );
  });
});
