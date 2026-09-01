import { describe, expect, it } from 'vitest';

import {
  CRM_OPERATOR_AGENT_DEFINITION,
  validateCrmMutationProposal,
} from '@/lib/agent-engine/product-agents/crm-operator';

describe('CRM Operator product role', () => {
  it('starts in SHADOW and cannot execute CRM mutations directly', () => {
    expect(CRM_OPERATOR_AGENT_DEFINITION.id).toBe('crm_operator');
    expect(CRM_OPERATOR_AGENT_DEFINITION.version).toBe('1.0.0');
    expect(CRM_OPERATOR_AGENT_DEFINITION.autonomyLevel).toBe('shadow');
    expect(CRM_OPERATOR_AGENT_DEFINITION.allowedTools).toEqual([]);
  });

  it('accepts only reversible CRM mutation proposals', () => {
    expect(validateCrmMutationProposal({
      kind: 'crm_mutation_proposal',
      operation: 'add_note',
      targetId: 'lead-123',
      changes: { note: 'Customer requested follow-up.' },
      rationale: 'Capture authoritative conversation fact after review.',
    })).toEqual({ ok: true });

    expect(validateCrmMutationProposal({
      kind: 'crm_mutation_proposal',
      operation: 'delete_contact',
      targetId: 'lead-123',
      changes: {},
      rationale: 'destructive',
    })).toEqual({ ok: false, reason: 'invalid_operation' });
  });

  it('does not expose direct database execution entrypoints', async () => {
    const importedModule = await import('@/lib/agent-engine/product-agents/crm-operator');
    expect('executeMutation' in importedModule).toBe(false);
    expect('getSupabaseAdmin' in importedModule).toBe(false);
    expect('serviceRole' in importedModule).toBe(false);
  });
});
