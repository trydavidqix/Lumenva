import { describe, expect, it } from 'vitest';
import { buildPhase6MemoryHygieneSignal } from '../flywheel/live-phase6';

describe('legacy flywheel Phase 6 adapter', () => {
  it('emits a privacy-safe normalized signal only from authoritative scope', () => {
    const signal = buildPhase6MemoryHygieneSignal({
      jobId: 'abcd1234-job',
      organizationId: 'org-1',
      scope: { organizationId: 'org-1', agentId: 'agent-1', capabilityId: 'memory-hygiene' },
    });
    expect(signal.kind).toBe('eval_failure');
    expect(signal.scope.agentId).toBe('agent-1');
    expect(signal.evidenceRef).toContain('abcd1234-job');
    expect(signal).not.toHaveProperty('transcript');
    expect(signal).not.toHaveProperty('contactId');
  });

  it('fails closed when the resolver returns a cross-tenant scope', () => {
    expect(() => buildPhase6MemoryHygieneSignal({
      jobId: 'abcd1234-job', organizationId: 'org-1',
      scope: { organizationId: 'org-2', agentId: 'agent-1', capabilityId: 'memory-hygiene' },
    })).toThrow('flywheel_signal_scope_mismatch');
  });
});
