import { describe, expect, it } from 'vitest';

import { canUseTrustedCapability, reconcileCapabilityTrust, type CapabilityTrustRecord } from '../hermes/capability-trust';

const trusted: CapabilityTrustRecord = {
  organizationId: 'org-a',
  kind: 'skill',
  canonicalIdentity: 'sales.followup',
  immutableRevision: 'git:abc',
  contentFingerprint: 'content-v1',
  permissionFingerprint: 'perm-v1',
  trustStatus: 'trusted',
  evidenceRefs: ['eval:1'],
  inspectedAt: '2026-09-13T00:00:00.000Z',
};

describe('Hermes capability trust', () => {
  it('keeps trust only while identity and permissions are unchanged', () => {
    expect(reconcileCapabilityTrust(trusted, trusted)).toBe('trusted');
    expect(canUseTrustedCapability(trusted, trusted)).toBe(true);
  });

  it('invalidates trust when content, revision or permissions change', () => {
    expect(reconcileCapabilityTrust(trusted, { ...trusted, contentFingerprint: 'content-v2' })).toBe('stale');
    expect(reconcileCapabilityTrust(trusted, { ...trusted, immutableRevision: 'git:def' })).toBe('stale');
    expect(reconcileCapabilityTrust(trusted, { ...trusted, permissionFingerprint: 'perm-v2' })).toBe('stale');
  });
});
