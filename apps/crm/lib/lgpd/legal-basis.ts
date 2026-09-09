export type LegalBasis = "consent" | "contract" | "legal_obligation" | "legitimate_interests" | "vital_interests" | "public_task";
export type LegalPurpose = "marketing" | "transactional" | "profiling";

export interface LegalBasisRecord {
  purpose: LegalPurpose;
  legal_basis: LegalBasis;
  text_version?: string | null;
  recorded_at: string;
  evidence: Record<string, unknown>;
  channel?: string | null;
  revoked_at?: string | null;
}

export const LEGAL_BASIS_V1 = process.env.LEGAL_BASIS_V1 === "true";

export function revokePurpose(records: LegalBasisRecord[], purpose: LegalPurpose, revokedAt: string): LegalBasisRecord[] {
  return records.map((record) => record.purpose === purpose && !record.revoked_at ? { ...record, revoked_at: revokedAt } : record);
}

export function canContactForPurpose(records: LegalBasisRecord[], purpose: LegalPurpose): boolean {
  return records.some((record) => record.purpose === purpose && !record.revoked_at && (record.legal_basis !== "consent" || Boolean(record.evidence.granted_at)));
}
