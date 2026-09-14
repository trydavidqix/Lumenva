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

type ConsentInput = Omit<ConsentRecord, "status" | "granted_at" | "revoked_at"> & { granted_at?: string };

function validTimestamp(value: string | undefined): boolean {
  return value === undefined || Number.isFinite(Date.parse(value));
}

function normalizeTimestamp(value: string | Date | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("consent_timestamp_invalid");
  return date.toISOString();
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function consentMatchesInput(existing: ConsentRecord, input: ConsentInput): boolean {
  if (existing.organization_id !== input.organization_id) return false;
  if (existing.subject_ref !== input.subject_ref || existing.purpose !== input.purpose || existing.channel !== input.channel) return false;
  if ((existing.legal_basis_ref ?? undefined) !== (input.legal_basis_ref ?? undefined)) return false;
  if ((existing.retention_until ?? undefined) !== normalizeTimestamp(input.retention_until)) return false;
  if (input.granted_at && existing.granted_at !== normalizeTimestamp(input.granted_at)) return false;
  return arraysEqual(existing.source_refs, input.source_refs) && arraysEqual(existing.evidence_refs, input.evidence_refs);
}

export class ConsentRegistry {
  private readonly records = new Map<string, ConsentRecord>();

  register(input: ConsentInput): ConsentRecord {
    if (!validTimestamp(input.granted_at) || !validTimestamp(input.retention_until)) throw new Error("consent_timestamp_invalid");
    const existing = this.records.get(input.consent_id);
    if (existing && existing.organization_id !== input.organization_id) throw new Error("consent_tenant_mismatch");
    if (existing) {
      if (!consentMatchesInput(existing, input)) throw new Error("consent_conflict");
      return structuredClone(existing);
    }
    const grantedAt = normalizeTimestamp(input.granted_at ?? new Date().toISOString())!;
    const retentionUntil = input.retention_until ? normalizeTimestamp(input.retention_until)! : undefined;
    const record: ConsentRecord = {
      ...structuredClone(input),
      status: "GRANTED",
      granted_at: grantedAt,
      ...(retentionUntil ? { retention_until: retentionUntil } : {}),
      source_refs: [...input.source_refs],
      evidence_refs: [...input.evidence_refs],
    };
    this.records.set(record.consent_id, record);
    return structuredClone(record);
  }

  revoke(organizationId: string, consentId: string, revokedAt = new Date().toISOString()): ConsentRecord {
    const record = this.records.get(consentId);
    if (!record) throw new Error("consent_not_found");
    if (record.organization_id !== organizationId) throw new Error("consent_tenant_mismatch");
    if (!validTimestamp(revokedAt)) throw new Error("consent_timestamp_invalid");
    const normalizedRevokedAt = normalizeTimestamp(revokedAt)!;
    const revoked: ConsentRecord = { ...record, status: "REVOKED", revoked_at: normalizedRevokedAt };
    this.records.set(consentId, revoked);
    return structuredClone(revoked);
  }

  get(organizationId: string, consentId: string): ConsentRecord | undefined {
    const record = this.records.get(consentId);
    if (!record || record.organization_id !== organizationId) return undefined;
    return structuredClone(record);
  }

  canContact(organizationId: string, subjectRef: string, channel: ConsentChannel, purpose: string, now = new Date()): boolean {
    const nowMs = now.getTime();
    if (!Number.isFinite(nowMs)) return false;
    return [...this.records.values()].some((record) => {
      if (record.organization_id !== organizationId || record.subject_ref !== subjectRef || record.channel !== channel || record.purpose !== purpose || record.status !== "GRANTED") return false;
      const grantedMs = record.granted_at ? Date.parse(record.granted_at) : Number.NaN;
      if (!Number.isFinite(grantedMs) || grantedMs > nowMs) return false;
      if (record.retention_until) {
        const retentionMs = Date.parse(record.retention_until);
        if (!Number.isFinite(retentionMs) || retentionMs <= nowMs) return false;
      }
      return true;
    });
  }
}

export type ConsentQueryable = { query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }> };

type StoredConsentRecord = Omit<ConsentRecord, "legal_basis_ref" | "granted_at" | "revoked_at" | "retention_until"> & {
  legal_basis_ref?: string | null;
  granted_at?: string | Date | null;
  revoked_at?: string | Date | null;
  retention_until?: string | Date | null;
  source_refs: string[];
  evidence_refs: string[];
};

function rowToConsent(row: StoredConsentRecord): ConsentRecord {
  const grantedAt = row.granted_at ? normalizeTimestamp(row.granted_at)! : undefined;
  const revokedAt = row.revoked_at ? normalizeTimestamp(row.revoked_at)! : undefined;
  const retentionUntil = row.retention_until ? normalizeTimestamp(row.retention_until)! : undefined;
  return {
    consent_id: row.consent_id,
    organization_id: row.organization_id,
    subject_ref: row.subject_ref,
    purpose: row.purpose,
    channel: row.channel,
    ...(row.legal_basis_ref ? { legal_basis_ref: row.legal_basis_ref } : {}),
    status: row.status,
    ...(grantedAt ? { granted_at: grantedAt } : {}),
    ...(revokedAt ? { revoked_at: revokedAt } : {}),
    ...(retentionUntil ? { retention_until: retentionUntil } : {}),
    source_refs: [...row.source_refs],
    evidence_refs: [...row.evidence_refs],
  };
}

/** Durable consent source of truth. The in-memory registry remains fixture-only. */
export class PostgresConsentRegistry {
  constructor(private readonly db: ConsentQueryable) {}

  async register(input: ConsentInput): Promise<ConsentRecord> {
    if (!validTimestamp(input.granted_at) || !validTimestamp(input.retention_until)) throw new Error("consent_timestamp_invalid");
    const grantedAt = normalizeTimestamp(input.granted_at ?? new Date().toISOString())!;
    const retentionUntil = normalizeTimestamp(input.retention_until);
    const inserted = await this.db.query<StoredConsentRecord>(
      `insert into public.contact_consents (consent_id,organization_id,subject_ref,purpose,channel,legal_basis_ref,status,granted_at,retention_until,source_refs,evidence_refs) values ($1,$2,$3,$4,$5,$6,'GRANTED',$7,$8,$9::jsonb,$10::jsonb) on conflict (organization_id,consent_id) do nothing returning consent_id,organization_id,subject_ref,purpose,channel,legal_basis_ref,status,granted_at,revoked_at,retention_until,source_refs,evidence_refs`,
      [input.consent_id, input.organization_id, input.subject_ref, input.purpose, input.channel, input.legal_basis_ref ?? null, grantedAt, retentionUntil ?? null, JSON.stringify(input.source_refs), JSON.stringify(input.evidence_refs)],
    );
    if (inserted.rows[0]) return rowToConsent(inserted.rows[0]);
    const existing = await this.get(input.organization_id, input.consent_id);
    if (!existing) throw new Error("consent_not_found");
    if (!consentMatchesInput(existing, { ...input, ...(retentionUntil ? { retention_until: retentionUntil } : {}) })) throw new Error("consent_conflict");
    return existing;
  }

  async revoke(organizationId: string, consentId: string, revokedAt = new Date().toISOString()): Promise<ConsentRecord> {
    if (!validTimestamp(revokedAt)) throw new Error("consent_timestamp_invalid");
    const normalizedRevokedAt = normalizeTimestamp(revokedAt)!;
    const result = await this.db.query<StoredConsentRecord>(
      `update public.contact_consents set status='REVOKED',revoked_at=$3,updated_at=now() where organization_id=$1 and consent_id=$2 and status='GRANTED' returning consent_id,organization_id,subject_ref,purpose,channel,legal_basis_ref,status,granted_at,revoked_at,retention_until,source_refs,evidence_refs`,
      [organizationId, consentId, normalizedRevokedAt],
    );
    if (!result.rows[0]) throw new Error("consent_not_found");
    return rowToConsent(result.rows[0]);
  }

  async get(organizationId: string, consentId: string): Promise<ConsentRecord | undefined> {
    const result = await this.db.query<StoredConsentRecord>(
      `select consent_id,organization_id,subject_ref,purpose,channel,legal_basis_ref,status,granted_at,revoked_at,retention_until,source_refs,evidence_refs from public.contact_consents where organization_id=$1 and consent_id=$2`,
      [organizationId, consentId],
    );
    return result.rows[0] ? rowToConsent(result.rows[0]) : undefined;
  }

  async canContact(organizationId: string, subjectRef: string, channel: ConsentChannel, purpose: string): Promise<boolean> {
    const result = await this.db.query<{ allowed: boolean }>(
      `select exists(select 1 from public.contact_consents where organization_id=$1 and subject_ref=$2 and channel=$3 and purpose=$4 and status='GRANTED' and granted_at <= now() and (retention_until is null or retention_until > now())) as allowed`,
      [organizationId, subjectRef, channel, purpose],
    );
    return result.rows[0]?.allowed === true;
  }
}
