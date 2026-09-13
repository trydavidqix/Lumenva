import { describe, expect, it } from 'vitest';

import { combineEvidenceStates, evidenceStatePasses } from '../hermes/evidence-state';

describe('Hermes explicit evidence states', () => {
  it('treats only explicit PASS as pass', () => {
    expect(evidenceStatePasses('PASS')).toBe(true);
    expect(evidenceStatePasses('FAIL')).toBe(false);
    expect(evidenceStatePasses('NOT_EXECUTED')).toBe(false);
    expect(evidenceStatePasses('NOT_PROVEN')).toBe(false);
    expect(evidenceStatePasses('BLOCKED')).toBe(false);
  });

  it('never upgrades missing or blocked evidence to PASS', () => {
    expect(combineEvidenceStates(['PASS', 'NOT_PROVEN'])).toBe('NOT_PROVEN');
    expect(combineEvidenceStates(['PASS', 'BLOCKED'])).toBe('BLOCKED');
    expect(combineEvidenceStates(['PASS', 'FAIL'])).toBe('FAIL');
    expect(combineEvidenceStates([])).toBe('NOT_EXECUTED');
  });
});
