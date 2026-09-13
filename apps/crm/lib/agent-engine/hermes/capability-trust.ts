import { createHash } from 'node:crypto';

export type CapabilityTrustStatus = 'unknown' | 'inspected' | 'trusted' | 'rejected' | 'stale';

export interface CapabilityIdentity {
  kind: string;
  canonicalIdentity: string;
  immutableRevision: string | null;
  contentFingerprint: string;
  permissionFingerprint: string;
}

export interface CapabilityTrustRecord extends CapabilityIdentity {
  organizationId: string;
  trustStatus: CapabilityTrustStatus;
  evidenceRefs: string[];
  inspectedAt: string | null;
}

export function capabilityIdentityFingerprint(identity: CapabilityIdentity): string {
  if (!identity.kind || !identity.canonicalIdentity || !identity.contentFingerprint || !identity.permissionFingerprint) {
    throw new Error('hermes_capability_identity_invalid');
  }
  return createHash('sha256')
    .update(
      JSON.stringify({
        kind: identity.kind.trim().toLowerCase(),
        canonicalIdentity: identity.canonicalIdentity.trim(),
        immutableRevision: identity.immutableRevision?.trim() || null,
        contentFingerprint: identity.contentFingerprint.trim(),
        permissionFingerprint: identity.permissionFingerprint.trim(),
      }),
      'utf8',
    )
    .digest('hex');
}

export function reconcileCapabilityTrust(
  previous: CapabilityTrustRecord | null,
  current: CapabilityIdentity,
): CapabilityTrustStatus {
  if (!previous) return 'unknown';
  const sameIdentity = capabilityIdentityFingerprint(previous) === capabilityIdentityFingerprint(current);
  if (!sameIdentity && previous.trustStatus === 'trusted') return 'stale';
  if (!sameIdentity && previous.trustStatus === 'inspected') return 'stale';
  return sameIdentity ? previous.trustStatus : 'unknown';
}

export function canUseTrustedCapability(
  record: CapabilityTrustRecord,
  current: CapabilityIdentity,
): boolean {
  return record.trustStatus === 'trusted' && reconcileCapabilityTrust(record, current) === 'trusted';
}
