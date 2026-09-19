import type { LegalBasisRecord, LegalPurpose } from "@/lib/lgpd/legal-basis";
import type { ChannelName } from "./types";

/**
 * Channel consent is evaluated at the gateway boundary, after tenant/contact
 * resolution. A provider webhook can report an event, but it can never grant
 * permission for a later outbound message.
 */
export function hasChannelConsent(
  records: ReadonlyArray<LegalBasisRecord>,
  purpose: LegalPurpose,
  channel: ChannelName,
): boolean {
  return records.some((record) => {
    if (record.purpose !== purpose || record.revoked_at) return false;
    if (record.channel && record.channel !== channel) return false;
    return record.legal_basis !== "consent" || Boolean(record.evidence.granted_at);
  });
}

export function assertChannelConsent(
  records: ReadonlyArray<LegalBasisRecord>,
  purpose: LegalPurpose,
  channel: ChannelName,
): void {
  if (!hasChannelConsent(records, purpose, channel)) {
    throw new Error("channel_consent_required");
  }
}
