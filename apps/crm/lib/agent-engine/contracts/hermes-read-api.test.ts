import { describe, expect, it } from 'vitest';

import { parseHermesReadQuery, phase6EvidenceStatus } from '../hermes/read-api';

describe('Hermes read API contract', () => {
  it('never accepts tenant scope from query input', () => {
    expect(() => parseHermesReadQuery(new URLSearchParams('organization_id=org-b'))).toThrow(
      'hermes_tenant_override_forbidden',
    );
    expect(() => parseHermesReadQuery(new URLSearchParams('tenantId=org-b'))).toThrow(
      'hermes_tenant_override_forbidden',
    );
  });

  it('bounds result sizes and accepts read-only filters', () => {
    expect(parseHermesReadQuery(new URLSearchParams('limit=25&status=keep&type=prompt_change'))).toEqual({
      limit: 25,
      status: 'keep',
      type: 'prompt_change',
    });
    expect(() => parseHermesReadQuery(new URLSearchParams('limit=5000'))).toThrow(
      'hermes_read_query_invalid',
    );
  });

  it('reads Phase 6 status only from the namespaced evidence envelope', () => {
    expect(phase6EvidenceStatus({ phase6: { status: 'ready_for_human_review' } })).toBe(
      'ready_for_human_review',
    );
    expect(phase6EvidenceStatus({ status: 'approved' })).toBeNull();
  });
});
