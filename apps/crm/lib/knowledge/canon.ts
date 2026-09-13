export type CanonPrecedence =
  | 'PROJECT_CANONICAL'
  | 'OFFICIAL_VENDOR'
  | 'APPROVED_INTERNAL_DOC'
  | 'derived'
  | 'model';

export interface CanonDocument {
  documentId: string;
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

/** Versioned in-memory canon; resolution always prefers source authority first. */
export class CanonRegistry {
  private readonly documents = new Map<string, CanonDocument[]>();

  register(document: CanonDocument): void {
    if (document.documentId.trim().length === 0) throw new Error('documentId is required');
    if (document.key.trim().length === 0) throw new Error('canon key is required');
    if (document.version.trim().length === 0) throw new Error('canon version is required');
    const versions = this.documents.get(document.key) ?? [];
    if (versions.some((item) => item.documentId === document.documentId)) {
      throw new Error(`canon document already registered: ${document.documentId}`);
    }
    versions.push({ ...document });
    this.documents.set(document.key, versions);
  }

  resolve(key: string): CanonDocument | undefined {
    const versions = this.documents.get(key);
    if (versions === undefined || versions.length === 0) return undefined;
    const selected = [...versions].sort((a, b) =>
      precedenceRank[b.precedence] - precedenceRank[a.precedence]
      || b.updatedAt.localeCompare(a.updatedAt)
      || b.version.localeCompare(a.version),
    )[0];
    return selected === undefined ? undefined : { ...selected };
  }

  list(key: string): CanonDocument[] {
    return (this.documents.get(key) ?? []).map((document) => ({ ...document }));
  }
}
