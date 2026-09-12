export type ConsentChannel = "whatsapp" | "email" | "voice";
export type ConsentStatus = "GRANTED" | "REVOKED" | "EXPIRED" | "UNKNOWN";
export type ConsentRecord = {
  consent_id: string;
  organization_id: string;
  subject_ref: string;
  purpose: string;
  channel: ConsentChannel;
  legal_basis_ref?: string;
  status: ConsentStatus;
  granted_at?: string;
  revoked_at?: string;
  retention_until?: string;
  source_refs: string[];
  evidence_refs: string[];
};

export class ConsentRegistry {
  private readonly records = new Map<string, ConsentRecord>();

  register(input: Omit<ConsentRecord, "status" | "granted_at" | "revoked_at"> & { granted_at?: string }): ConsentRecord {
    const existing = this.records.get(input.consent_id);
    if (existing && existing.organization_id !== input.organization_id) throw new Error("consent_tenant_mismatch");
    if (existing) return structuredClone(existing);
    const grantedAt = input.granted_at ?? new Date().toISOString();
    if (!Number.isFinite(Date.parse(grantedAt))) throw new Error("consent_timestamp_invalid");
    const record: ConsentRecord = { ...structuredClone(input), status: "GRANTED", granted_at: grantedAt, source_refs: [...input.source_refs], evidence_refs: [...input.evidence_refs] };
    this.records.set(record.consent_id, record);
    return structuredClone(record);
  }

  revoke(organizationId: string, consentId: string, revokedAt = new Date().toISOString()): ConsentRecord {
    const record = this.records.get(consentId);
    if (!record) throw new Error("consent_not_found");
    if (record.organization_id !== organizationId) throw new Error("consent_tenant_mismatch");
    if (!Number.isFinite(Date.parse(revokedAt))) throw new Error("consent_timestamp_invalid");
    const revoked = { ...record, status: "REVOKED" as const, revoked_at: revokedAt };
    this.records.set(consentId, revoked);
    return structuredClone(revoked);
  }

  get(organizationId: string, consentId: string): ConsentRecord | undefined {
    const record = this.records.get(consentId);
    if (!record || record.organization_id !== organizationId) return undefined;
    return structuredClone(record);
  }

  canContact(organizationId: string, subjectRef: string, channel: ConsentChannel, purpose: string): boolean {
    return [...this.records.values()].some((record) => record.organization_id === organizationId && record.subject_ref === subjectRef && record.channel === channel && record.purpose === purpose && record.status === "GRANTED");
  }
}
