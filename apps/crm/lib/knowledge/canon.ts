export type CanonPrecedence =
  | 'PROJECT_CANONICAL'
  | 'OFFICIAL_VENDOR'
  | 'APPROVED_INTERNAL_DOC'
  | 'derived'
  | 'model';

export interface CanonDocument {
  documentId: string;
  tenantId: string;
  key: string;
  content: string;
  version: string;
  precedence: CanonPrecedence;
  source: string;
  updatedAt: string;
}

const precedenceRank: Record<CanonPrecedence, number> = {
  PROJECT_CANONICAL: 5,
  OFFICIAL_VENDOR: 4,
  APPROVED_INTERNAL_DOC: 3,
  derived: 2,
  model: 1,
};

const isPrecedence = (value: unknown): value is CanonPrecedence =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(precedenceRank, value);

const registryKey = (tenantId: string, key: string): string => `${tenantId}\u0000${key}`;

/** Versioned tenant-isolated canon; resolution always prefers source authority first. */
export class CanonRegistry {
  private readonly documents = new Map<string, CanonDocument[]>();

  register(document: CanonDocument): void {
    if (document.documentId.trim().length === 0) throw new Error('documentId is required');
    if (document.tenantId.trim().length === 0) throw new Error('tenantId is required');
    if (document.key.trim().length === 0) throw new Error('canon key is required');
    if (document.version.trim().length === 0) throw new Error('canon version is required');
    if (!isPrecedence(document.precedence)) throw new Error(`invalid canon precedence: ${String(document.precedence)}`);
    if (!Number.isFinite(Date.parse(document.updatedAt))) throw new Error('updatedAt must be a valid timestamp');
    const key = registryKey(document.tenantId, document.key);
    const versions = this.documents.get(key) ?? [];
    if (versions.some((item) => item.documentId === document.documentId)) {
      throw new Error(`canon document already registered: ${document.documentId}`);
    }
    versions.push({ ...document });
    this.documents.set(key, versions);
  }

  resolve(tenantId: string, key: string): CanonDocument | undefined {
    const versions = this.documents.get(registryKey(tenantId, key));
    if (versions === undefined || versions.length === 0) return undefined;
    const selected = [...versions].sort((a, b) =>
      precedenceRank[b.precedence] - precedenceRank[a.precedence]
      || b.updatedAt.localeCompare(a.updatedAt)
      || b.version.localeCompare(a.version),
    )[0];
    return selected === undefined ? undefined : { ...selected };
  }

  list(tenantId: string, key: string): CanonDocument[] {
    return (this.documents.get(registryKey(tenantId, key)) ?? []).map((document) => ({ ...document }));
  }
}
