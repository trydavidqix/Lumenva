import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/database.types";

import type {
  CompetitorMonitorRecord,
  CompetitorRecord,
  ContentSourceRecord,
  IntelligenceRepository,
} from "./source-service";
import type {
  ContentOpportunityRecord,
  ContentSignalRecord,
  SignalCollectionRepository,
} from "./collection-service";

type Db = SupabaseClient<Database>;

function asRecord(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toJson(value: Record<string, unknown>): Json {
  try {
    return JSON.parse(JSON.stringify(value)) as Json;
  } catch {
    throw new Error("Content OS configuration must be JSON-serializable");
  }
}

function source(row: Database["public"]["Tables"]["content_sources"]["Row"]): ContentSourceRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    provider: row.provider,
    sourceType: row.source_type,
    configuration: asRecord(row.configuration),
    status: row.status as ContentSourceRecord["status"],
    externalRef: row.external_ref,
  };
}

function competitor(row: Database["public"]["Tables"]["competitors"]["Row"]): CompetitorRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    websiteUrl: row.website_url,
    notes: row.notes,
    status: row.status as CompetitorRecord["status"],
  };
}

function monitor(row: Database["public"]["Tables"]["competitor_monitors"]["Row"]): CompetitorMonitorRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    competitorId: row.competitor_id,
    provider: row.provider,
    monitorType: row.monitor_type,
    targetUrl: row.target_url,
    configuration: asRecord(row.configuration),
    providerMonitorId: row.provider_monitor_id,
    status: row.status as CompetitorMonitorRecord["status"],
  };
}

function signal(row: Database["public"]["Tables"]["content_signals"]["Row"]): ContentSignalRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sourceId: row.source_id,
    provider: row.provider,
    externalId: row.external_id,
    rawHash: row.raw_hash,
    sourceUrl: row.source_url,
    title: row.title,
    body: row.body,
    publishedAt: row.published_at,
    observedAt: row.observed_at,
    metadata: asRecord(row.metadata),
  };
}

function opportunity(row: Database["public"]["Tables"]["content_opportunities"]["Row"]): ContentOpportunityRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    signalId: row.signal_id,
    title: row.title,
    rationale: row.rationale,
    priority: row.priority,
    status: row.status as ContentOpportunityRecord["status"],
    metadata: asRecord(row.metadata),
  };
}

function requireRow<T>(data: T | null, error: { message: string; code?: string } | null): T {
  if (error) {
    const failure = new Error(error.message) as Error & { code?: string };
    failure.code = error.code;
    throw failure;
  }
  if (!data) throw new Error("Content OS persistence failed");
  return data;
}

/** Maps Content OS domain records to the existing Supabase schema. */
export class SupabaseIntelligenceRepository implements IntelligenceRepository, SignalCollectionRepository {
  constructor(private readonly db: Db) {}

  async createSource(input: Omit<ContentSourceRecord, "id" | "status" | "externalRef">): Promise<ContentSourceRecord> {
    const { data, error } = await this.db
      .from("content_sources")
      .insert({
        organization_id: input.organizationId,
        name: input.name,
        provider: input.provider,
        source_type: input.sourceType,
        configuration: toJson(input.configuration),
      })
      .select()
      .single();
    return source(requireRow(data, error));
  }

  async findSource(organizationId: string, sourceId: string): Promise<ContentSourceRecord | null> {
    const { data, error } = await this.db
      .from("content_sources")
      .select()
      .eq("organization_id", organizationId)
      .eq("id", sourceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? source(data) : null;
  }

  async findSignalByDedupKey(input: {
    organizationId: string;
    provider: string;
    sourceId: string;
    externalId: string;
    rawHash: string;
  }): Promise<ContentSignalRecord | null> {
    const base = this.db.from("content_signals").select().eq("organization_id", input.organizationId)
      .eq("provider", input.provider).eq("source_id", input.sourceId);
    const byExternal = await base.eq("external_id", input.externalId).maybeSingle();
    if (byExternal.error) throw new Error(byExternal.error.message);
    if (byExternal.data) return signal(byExternal.data);
    const byHash = await this.db.from("content_signals").select().eq("organization_id", input.organizationId)
      .eq("provider", input.provider).eq("source_id", input.sourceId).eq("raw_hash", input.rawHash).maybeSingle();
    if (byHash.error) throw new Error(byHash.error.message);
    return byHash.data ? signal(byHash.data) : null;
  }

  async createSignal(input: Omit<ContentSignalRecord, "id">): Promise<ContentSignalRecord> {
    const { data, error } = await this.db.from("content_signals").insert({
      organization_id: input.organizationId,
      source_id: input.sourceId,
      provider: input.provider,
      external_id: input.externalId,
      raw_hash: input.rawHash,
      source_url: input.sourceUrl,
      title: input.title,
      body: input.body,
      published_at: input.publishedAt,
      observed_at: input.observedAt,
      metadata: toJson(input.metadata),
    }).select().single();
    return signal(requireRow(data, error));
  }

  async findOpportunityBySignal(organizationId: string, signalId: string): Promise<ContentOpportunityRecord | null> {
    const { data, error } = await this.db.from("content_opportunities").select().eq("organization_id", organizationId)
      .eq("signal_id", signalId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? opportunity(data) : null;
  }

  async createOpportunity(input: Omit<ContentOpportunityRecord, "id">): Promise<ContentOpportunityRecord> {
    const { data, error } = await this.db.from("content_opportunities").insert({
      organization_id: input.organizationId,
      signal_id: input.signalId,
      title: input.title,
      rationale: input.rationale,
      priority: input.priority,
      status: input.status,
      metadata: toJson(input.metadata),
    }).select().single();
    return opportunity(requireRow(data, error));
  }

  async updateSource(organizationId: string, sourceId: string, patch: Partial<Pick<ContentSourceRecord, "configuration" | "status">>): Promise<ContentSourceRecord | null> {
    const { data, error } = await this.db
      .from("content_sources")
      .update({
        ...(patch.configuration ? { configuration: toJson(patch.configuration) } : {}),
        ...(patch.status ? { status: patch.status } : {}),
      })
      .eq("organization_id", organizationId)
      .eq("id", sourceId)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? source(data) : null;
  }

  async createCompetitor(input: Omit<CompetitorRecord, "id" | "notes" | "status"> & { notes?: string | null }): Promise<CompetitorRecord> {
    const { data, error } = await this.db
      .from("competitors")
      .insert({ organization_id: input.organizationId, name: input.name, website_url: input.websiteUrl, notes: input.notes })
      .select()
      .single();
    return competitor(requireRow(data, error));
  }

  async findCompetitor(organizationId: string, competitorId: string): Promise<CompetitorRecord | null> {
    const { data, error } = await this.db.from("competitors").select().eq("organization_id", organizationId).eq("id", competitorId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? competitor(data) : null;
  }

  async createMonitor(input: Omit<CompetitorMonitorRecord, "id" | "providerMonitorId" | "status">): Promise<CompetitorMonitorRecord> {
    const { data, error } = await this.db.from("competitor_monitors").insert({
      organization_id: input.organizationId,
      competitor_id: input.competitorId,
      provider: input.provider,
      monitor_type: input.monitorType,
      target_url: input.targetUrl,
      configuration: toJson(input.configuration),
    }).select().single();
    return monitor(requireRow(data, error));
  }

  async updateMonitor(organizationId: string, monitorId: string, patch: Partial<Pick<CompetitorMonitorRecord, "configuration" | "providerMonitorId" | "status">>): Promise<CompetitorMonitorRecord | null> {
    const { data, error } = await this.db.from("competitor_monitors").update({
      ...(patch.configuration ? { configuration: toJson(patch.configuration) } : {}),
      ...(patch.providerMonitorId !== undefined ? { provider_monitor_id: patch.providerMonitorId } : {}),
      ...(patch.status ? { status: patch.status } : {}),
    }).eq("organization_id", organizationId).eq("id", monitorId).select().maybeSingle();
    if (error) throw new Error(error.message);
    return data ? monitor(data) : null;
  }

  async emit(input: { type: string; organizationId: string; entityId: string; metadata?: Record<string, unknown> }): Promise<void> {
    const entityKind = input.type === "content.signal_collected"
      ? "content_signal"
      : input.type === "content.opportunity_created"
        ? "content_opportunity"
        : "content_source";
    const { error } = await this.db.from("event_log").insert({
      organization_id: input.organizationId,
      event_type: input.type,
      entity_kind: entityKind,
      entity_id: input.entityId,
      payload: { organizationId: input.organizationId, entityId: input.entityId },
      metadata: toJson(input.metadata ?? {}),
    });
    if (error) throw new Error(error.message);
  }
}
