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

export type ConsentQueryable = { query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }> };

type StoredConsentRecord = ConsentRecord & { source_refs: string[]; evidence_refs: string[] };

/** Durable consent source of truth. The in-memory registry remains fixture-only. */
export class PostgresConsentRegistry {
  constructor(private readonly db: ConsentQueryable) {}

  async register(input: Omit<ConsentRecord, "status" | "granted_at" | "revoked_at"> & { granted_at?: string }): Promise<ConsentRecord> {
    const grantedAt = input.granted_at ?? new Date().toISOString();
    if (!Number.isFinite(Date.parse(grantedAt))) throw new Error("consent_timestamp_invalid");
    const inserted = await this.db.query<StoredConsentRecord>(
      `insert into public.contact_consents (consent_id,organization_id,subject_ref,purpose,channel,legal_basis_ref,status,granted_at,retention_until,source_refs,evidence_refs) values ($1,$2,$3,$4,$5,$6,'GRANTED',$7,$8,$9::jsonb,$10::jsonb) on conflict (organization_id,consent_id) do nothing returning consent_id,organization_id,subject_ref,purpose,channel,legal_basis_ref,status,granted_at,revoked_at,retention_until,source_refs,evidence_refs`,
      [input.consent_id, input.organization_id, input.subject_ref, input.purpose, input.channel, input.legal_basis_ref ?? null, grantedAt, input.retention_until ?? null, JSON.stringify(input.source_refs), JSON.stringify(input.evidence_refs)],
    );
    if (inserted.rows[0]) return structuredClone(inserted.rows[0]);
    const existing = await this.get(input.organization_id, input.consent_id);
    if (!existing) throw new Error("consent_not_found");
    return existing;
  }

  async revoke(organizationId: string, consentId: string, revokedAt = new Date().toISOString()): Promise<ConsentRecord> {
    if (!Number.isFinite(Date.parse(revokedAt))) throw new Error("consent_timestamp_invalid");
    const result = await this.db.query<StoredConsentRecord>(
      `update public.contact_consents set status='REVOKED',revoked_at=$3,updated_at=now() where organization_id=$1 and consent_id=$2 and status='GRANTED' returning consent_id,organization_id,subject_ref,purpose,channel,legal_basis_ref,status,granted_at,revoked_at,retention_until,source_refs,evidence_refs`,
      [organizationId, consentId, revokedAt],
    );
    if (!result.rows[0]) throw new Error("consent_not_found");
    return structuredClone(result.rows[0]);
  }

  async get(organizationId: string, consentId: string): Promise<ConsentRecord | undefined> {
    const result = await this.db.query<StoredConsentRecord>(
      `select consent_id,organization_id,subject_ref,purpose,channel,legal_basis_ref,status,granted_at,revoked_at,retention_until,source_refs,evidence_refs from public.contact_consents where organization_id=$1 and consent_id=$2`,
      [organizationId, consentId],
    );
    return result.rows[0] ? structuredClone(result.rows[0]) : undefined;
  }

  async canContact(organizationId: string, subjectRef: string, channel: ConsentChannel, purpose: string): Promise<boolean> {
    const result = await this.db.query<{ allowed: boolean }>(
      `select exists(select 1 from public.contact_consents where organization_id=$1 and subject_ref=$2 and channel=$3 and purpose=$4 and status='GRANTED' and granted_at <= now() and (retention_until is null or retention_until > now())) as allowed`,
      [organizationId, subjectRef, channel, purpose],
    );
    return result.rows[0]?.allowed === true;
  }
}
