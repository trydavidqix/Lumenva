import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/database.types";

import type {
  CompetitorMonitorRecord,
  CompetitorRecord,
  ContentSourceRecord,
  IntelligenceRepository,
} from "./source-service";

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

function requireRow<T>(data: T | null, error: { message: string } | null): T {
  if (error || !data) throw new Error(error?.message ?? "Content OS persistence failed");
  return data;
}

/** Maps Content OS domain records to the existing Supabase schema. */
export class SupabaseIntelligenceRepository implements IntelligenceRepository {
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
    const { error } = await this.db.from("event_log").insert({
      organization_id: input.organizationId,
      event_type: input.type,
      entity_kind: "content_source",
      entity_id: input.entityId,
      payload: { organizationId: input.organizationId, entityId: input.entityId },
      metadata: toJson(input.metadata ?? {}),
    });
    if (error) throw new Error(error.message);
  }
}
