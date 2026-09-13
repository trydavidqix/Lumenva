import { ConsentRegistry, type ConsentChannel } from "./consent-registry";

export type ContactMemoryWrite = {
  owner: string;
  scope: string;
  authority: number;
  organization_id: string;
  subject_ref: string;
  channel: ConsentChannel;
  purpose: string;
};

export type MemoryGatePolicy = {
  owner: string;
  scope: string;
  authority: number;
};

export type MemoryGateDecision = "ALLOW" | "DENY";

/** Consent is checked before the generic authority gate; missing consent denies. */
export function evaluateContactMemoryGate(
  write: ContactMemoryWrite,
  policy: MemoryGatePolicy,
  consentRegistry: ConsentRegistry,
): MemoryGateDecision {
  if (!write || !policy || !consentRegistry) return "DENY";
  if (!consentRegistry.canContact(write.organization_id, write.subject_ref, write.channel, write.purpose)) return "DENY";
  if (typeof write.owner !== "string" || typeof write.scope !== "string" || !write.owner || !write.scope) return "DENY";
  if (write.owner !== policy.owner || write.scope !== policy.scope) return "DENY";
  if (!Number.isFinite(write.authority) || !Number.isFinite(policy.authority) || write.authority < policy.authority) return "DENY";
  return "ALLOW";
}

export type DurableConsentReader = { canContact(organizationId: string, subjectRef: string, channel: ConsentChannel, purpose: string): Promise<boolean> };

/** Async gate for the durable registry; all missing, expired or revoked consent denies. */
export async function evaluateContactMemoryGatePersisted(
  write: ContactMemoryWrite,
  policy: MemoryGatePolicy,
  consentRegistry: DurableConsentReader,
): Promise<MemoryGateDecision> {
  if (!write || !policy || !consentRegistry) return "DENY";
  if (!(await consentRegistry.canContact(write.organization_id, write.subject_ref, write.channel, write.purpose))) return "DENY";
  if (typeof write.owner !== "string" || typeof write.scope !== "string" || !write.owner || !write.scope) return "DENY";
  if (write.owner !== policy.owner || write.scope !== policy.scope) return "DENY";
  if (!Number.isFinite(write.authority) || !Number.isFinite(policy.authority) || write.authority < policy.authority) return "DENY";
  return "ALLOW";
}
