export type ContentFreshness = 'current' | 'stale' | 'unknown';

export interface ContentProvenanceInput {
  contentId: string;
  skill: string;
  content: string;
  source: string;
  freshness: ContentFreshness;
  confidence: number;
  generatedAt: string;
}

/** In-memory provider-free provenance ledger for generated marketing pieces. */
export class ContentProvenanceTracker {
  private readonly records = new Map<string, ContentProvenanceInput>();

  record(input: ContentProvenanceInput): ContentProvenanceInput {
    if (input.contentId.trim().length === 0) throw new Error('contentId is required');
    if (input.skill.trim().length === 0) throw new Error('skill is required');
    if (input.source.trim().length === 0) throw new Error('source is required');
    if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
      throw new Error('confidence must be between 0 and 1');
    }
    if (this.records.has(input.contentId)) {
      throw new Error(`content provenance already registered: ${input.contentId}`);
    }
    const stored = { ...input };
    this.records.set(input.contentId, stored);
    return { ...stored };
  }

  get(contentId: string): ContentProvenanceInput | undefined {
    const record = this.records.get(contentId);
    return record === undefined ? undefined : { ...record };
  }

  list(): ContentProvenanceInput[] {
    return [...this.records.values()].map((record) => ({ ...record }));
  }

  updateFreshness(contentId: string, freshness: ContentFreshness): void {
    const record = this.records.get(contentId);
    if (record === undefined) throw new Error(`content provenance not found: ${contentId}`);
    this.records.set(contentId, { ...record, freshness });
  }
}
