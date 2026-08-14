import { getSourceCatalogEntry } from "./source-catalog";

export type ContentSourceRecord = {
  id: string;
  organizationId: string;
  name: string;
  provider: string;
  sourceType: string;
  configuration: Record<string, unknown>;
  status: "active" | "disabled" | "failed";
  externalRef: string | null;
};

export type CompetitorRecord = {
  id: string;
  organizationId: string;
  name: string;
  websiteUrl: string | null;
  notes: string | null;
  status: "active" | "archived";
};

export type CompetitorMonitorRecord = {
  id: string;
  organizationId: string;
  competitorId: string;
  provider: string;
  monitorType: string;
  targetUrl: string;
  configuration: Record<string, unknown>;
  providerMonitorId: string | null;
  status: "pending" | "active" | "disabled" | "failed";
};

export type IntelligenceRepository = {
  createSource(input: Omit<ContentSourceRecord, "id" | "status" | "externalRef">): Promise<ContentSourceRecord>;
  findSource(organizationId: string, sourceId: string): Promise<ContentSourceRecord | null>;
  updateSource(
    organizationId: string,
    sourceId: string,
    patch: Partial<Pick<ContentSourceRecord, "configuration" | "status">>,
  ): Promise<ContentSourceRecord | null>;
  createCompetitor(input: Omit<CompetitorRecord, "id" | "notes" | "status"> & { notes?: string | null }): Promise<CompetitorRecord>;
  findCompetitor(organizationId: string, competitorId: string): Promise<CompetitorRecord | null>;
  createMonitor(
    input: Omit<CompetitorMonitorRecord, "id" | "providerMonitorId" | "status">,
  ): Promise<CompetitorMonitorRecord>;
  updateMonitor(
    organizationId: string,
    monitorId: string,
    patch: Partial<Pick<CompetitorMonitorRecord, "configuration" | "providerMonitorId" | "status">>,
  ): Promise<CompetitorMonitorRecord | null>;
  emit(input: { type: string; organizationId: string; entityId: string; metadata?: Record<string, unknown> }): Promise<void>;
};

export class ContentOsNotFoundError extends Error {
  readonly name = "ContentOsNotFoundError";

  constructor(entity: string) {
    super(`${entity} was not found`);
  }
}

export class ContentOsValidationError extends Error {
  readonly name = "ContentOsValidationError";
}

function containsCredential(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsCredential);
  if (!value || typeof value !== "object") return false;

  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) => /(?:api[_-]?key|secret|token|password)/i.test(key) || containsCredential(nested),
  );
}

/**
 * Domain service. Its organizationId parameter must only originate in trusted
 * server authentication or worker context, never from a browser DTO.
 */
export class ContentSourceService {
  constructor(private readonly repository: IntelligenceRepository) {}

  async create(input: Omit<ContentSourceRecord, "id" | "status" | "externalRef">): Promise<ContentSourceRecord> {
    if (containsCredential(input.configuration)) {
      throw new ContentOsValidationError("Provider credentials cannot be stored in a content source");
    }

    return this.repository.createSource(input);
  }

  async createFromCatalog(input: {
    organizationId: string;
    catalogKey: string;
  }): Promise<ContentSourceRecord> {
    const source = getSourceCatalogEntry(input.catalogKey);
    if (!source) {
      throw new ContentOsValidationError("Content source catalog key is not approved");
    }

    return this.create({
      organizationId: input.organizationId,
      name: source.name,
      provider: source.provider,
      sourceType: source.sourceType,
      configuration: source.configuration,
    });
  }

  async setStatus(input: {
    organizationId: string;
    sourceId: string;
    status: "active" | "disabled";
  }): Promise<ContentSourceRecord> {
    const source = await this.repository.updateSource(input.organizationId, input.sourceId, {
      status: input.status,
    });
    if (!source) throw new ContentOsNotFoundError("Content source");
    return source;
  }

  async requestCollection(input: {
    organizationId: string;
    sourceId: string;
  }): Promise<void> {
    const source = await this.repository.findSource(input.organizationId, input.sourceId);
    if (!source) throw new ContentOsNotFoundError("Content source");
    if (source.status !== "active") {
      throw new ContentOsValidationError("Only active sources can be collected");
    }

    await this.repository.emit({
      type: "content.source_collection_requested",
      organizationId: input.organizationId,
      entityId: source.id,
      metadata: { provider: source.provider },
    });
  }
}
