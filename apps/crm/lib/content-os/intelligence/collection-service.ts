import type { IntelligenceCollectInput, IntelligenceProvider, RawSignal } from "../providers/intelligence";
import { normalizeSignal } from "./normalize-signal";
import { signalDedupKey } from "./deduplicate";
import { ContentOsNotFoundError, ContentOsValidationError, type ContentSourceRecord } from "./source-service";

export type ContentSignalRecord = {
  id: string;
  organizationId: string;
  sourceId: string;
  provider: string;
  externalId: string;
  rawHash: string;
  sourceUrl: string | null;
  title: string;
  body: string | null;
  publishedAt: string | null;
  observedAt: string;
  metadata: Record<string, unknown>;
};

export type ContentOpportunityRecord = {
  id: string;
  organizationId: string;
  signalId: string | null;
  title: string;
  rationale: string | null;
  priority: number;
  status: "new" | "accepted" | "rejected" | "archived";
  metadata: Record<string, unknown>;
};

export type SignalCollectionRepository = {
  findSource(organizationId: string, sourceId: string): Promise<ContentSourceRecord | null>;
  findSignalByDedupKey(input: {
    organizationId: string;
    provider: string;
    sourceId: string;
    externalId: string;
    rawHash: string;
  }): Promise<ContentSignalRecord | null>;
  createSignal(input: Omit<ContentSignalRecord, "id">): Promise<ContentSignalRecord>;
  findOpportunityBySignal(organizationId: string, signalId: string): Promise<ContentOpportunityRecord | null>;
  createOpportunity(input: Omit<ContentOpportunityRecord, "id">): Promise<ContentOpportunityRecord>;
  emit(input: { type: string; organizationId: string; entityId: string; metadata?: Record<string, unknown> }): Promise<void>;
};

export type IntelligenceProviderRegistry = {
  get(provider: string): IntelligenceProvider | undefined;
};

export type CollectionResult = {
  sourceId: string;
  fetched: number;
  createdSignals: number;
  duplicateSignals: number;
  skippedSignals: number;
  createdOpportunities: number;
};

/** Deterministic V1 boundary: fetch controlled sources, normalize, dedupe, persist and emit. */
export class ContentCollectionService {
  constructor(
    private readonly repository: SignalCollectionRepository,
    private readonly providers: IntelligenceProviderRegistry,
  ) {}

  async collect(input: IntelligenceCollectInput): Promise<CollectionResult> {
    const source = await this.repository.findSource(input.organizationId, input.sourceId);
    if (!source) throw new ContentOsNotFoundError("Content source");
    if (source.status !== "active") {
      throw new ContentOsValidationError("Only active sources can be collected");
    }

    const provider = this.providers.get(source.provider);
    if (!provider) throw new ContentOsValidationError("Content source provider is not configured");
    const rawSignals = await provider.collect(input);
    const result: CollectionResult = {
      sourceId: source.id,
      fetched: rawSignals.length,
      createdSignals: 0,
      duplicateSignals: 0,
      skippedSignals: 0,
      createdOpportunities: 0,
    };
    const seen = new Set<string>();

    for (const raw of rawSignals) {
      const normalized = this.normalize(raw, result);
      if (!normalized) continue;
      const title = normalized.title;
      if (!title) {
        result.skippedSignals += 1;
        continue;
      }
      const dedupKey = signalDedupKey({
        organizationId: source.organizationId,
        provider: source.provider,
        sourceId: source.id,
        externalId: normalized.externalId,
        rawHash: normalized.rawHash,
      });
      if (seen.has(dedupKey)) {
        result.duplicateSignals += 1;
        continue;
      }
      seen.add(dedupKey);

      const dedupInput = {
        organizationId: source.organizationId,
        provider: source.provider,
        sourceId: source.id,
        externalId: normalized.externalId,
        rawHash: normalized.rawHash,
      };
      const existing = await this.repository.findSignalByDedupKey(dedupInput);
      if (existing) {
        result.duplicateSignals += 1;
        continue;
      }

      let signal: ContentSignalRecord;
      try {
        signal = await this.repository.createSignal({
          organizationId: source.organizationId,
          sourceId: source.id,
          provider: source.provider,
          externalId: normalized.externalId,
          rawHash: normalized.rawHash,
          sourceUrl: normalized.sourceUrl,
          title,
          body: normalized.body || null,
          publishedAt: normalized.publishedAt ?? null,
          observedAt: normalized.observedAt,
          metadata: normalized.metadata,
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const raced = await this.repository.findSignalByDedupKey(dedupInput);
        if (!raced) throw error;
        result.duplicateSignals += 1;
        continue;
      }
      result.createdSignals += 1;

      if (!(await this.repository.findOpportunityBySignal(source.organizationId, signal.id))) {
        await this.repository.createOpportunity({
          organizationId: source.organizationId,
          signalId: signal.id,
          title,
          rationale: normalized.body || null,
          priority: opportunityPriority(normalized, title),
          status: "new",
          metadata: { provider: source.provider, sourceId: source.id },
        });
        result.createdOpportunities += 1;
        await this.repository.emit({
          type: "content.opportunity_created",
          organizationId: source.organizationId,
          entityId: signal.id,
          metadata: { sourceId: source.id, provider: source.provider },
        });
      }
      await this.repository.emit({
        type: "content.signal_collected",
        organizationId: source.organizationId,
        entityId: signal.id,
        metadata: { sourceId: source.id, provider: source.provider },
      });
    }
    return result;
  }

  private normalize(raw: RawSignal, result: CollectionResult) {
    try {
      const normalized = normalizeSignal(raw);
      if (!normalized.title) throw new TypeError("Signal title is required");
      return normalized;
    } catch {
      result.skippedSignals += 1;
      return null;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "23505" || (typeof candidate.message === "string" && /duplicate key|unique constraint/i.test(candidate.message));
}

function opportunityPriority(signal: ReturnType<typeof normalizeSignal>, title: string): number {
  const recency = signal.publishedAt ? Math.max(0, 30 - Math.floor((Date.parse(signal.observedAt) - Date.parse(signal.publishedAt)) / 86_400_000)) : 0;
  return Math.min(100, 40 + Math.min(30, title.length) + Math.min(30, recency));
}
