import { describe, expect, it } from 'vitest';
import { canTransition } from './status';

describe('content status transitions', () => {
  it('does not allow pending approval to jump directly to publishing', () => {
    expect(canTransition('PENDING_APPROVAL', 'PUBLISHING')).toBe(false);
  });

  it('allows approved content to become scheduled', () => {
    expect(canTransition('APPROVED', 'SCHEDULED')).toBe(true);
  });
});
