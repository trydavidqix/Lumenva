import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/lib/database.types";
import { getChangeDetectionClientFromEnv } from "@/lib/content-os/providers/changedetection/client";
import { ChangeDetectionIntelligenceProvider } from "@/lib/content-os/providers/changedetection/provider";
import { getRssHubClientFromEnv } from "@/lib/content-os/providers/rsshub/client";
import { RSSHubIntelligenceProvider } from "@/lib/content-os/providers/rsshub/provider";

import { ContentCollectionService, type CollectionResult } from "./collection-service";
import { SupabaseIntelligenceRepository } from "./supabase-repository";
import type { ContentSourceRecord } from "./source-service";

type Db = SupabaseClient<Database>;

export type IntelligenceWorkerSource = Pick<ContentSourceRecord, "id" | "organizationId" | "provider" | "status" | "configuration">;

export type IntelligenceWorkerFailure = {
  sourceId: string;
  organizationId: string;
  provider: string;
  code: "provider_not_configured" | "collection_failed";
};

export type IntelligenceWorkerResult = {
  sources: number;
  succeeded: number;
  failed: number;
  collected: CollectionResult[];
  failures: IntelligenceWorkerFailure[];
};

export type IntelligenceWorkerDependencies = {
  listActiveSources(): Promise<IntelligenceWorkerSource[]>;
  collect(source: IntelligenceWorkerSource): Promise<CollectionResult>;
};

/**
 * Runs one bounded pass over server-owned active sources. A source failure is
 * isolated so one tenant/provider cannot starve the rest of the newsroom.
 */
export async function runIntelligenceWorker(
  dependencies: IntelligenceWorkerDependencies,
): Promise<IntelligenceWorkerResult> {
  const sources = await dependencies.listActiveSources();
  const result: IntelligenceWorkerResult = {
    sources: sources.length,
    succeeded: 0,
    failed: 0,
    collected: [],
    failures: [],
  };

  for (const source of sources) {
    try {
      const collection = await dependencies.collect(source);
      result.succeeded += 1;
      result.collected.push(collection);
    } catch (error) {
      result.failed += 1;
      result.failures.push({
        sourceId: source.id,
        organizationId: source.organizationId,
        provider: source.provider,
        code: error instanceof ProviderNotConfiguredError ? "provider_not_configured" : "collection_failed",
      });
    }
  }

  return result;
}

class ProviderNotConfiguredError extends Error {}

function asRecord(value: Json | null | undefined): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringConfig(config: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function sourceFromRow(row: {
  id: string;
  organization_id: string;
  provider: string;
  status: string;
  configuration: Json;
}): IntelligenceWorkerSource {
  return {
    id: row.id,
    organizationId: row.organization_id,
    provider: row.provider,
    status: row.status as ContentSourceRecord["status"],
    configuration: asRecord(row.configuration),
  };
}

/** Creates the production worker without allowing browser input to select a source. */
export function createSupabaseIntelligenceWorker(db: Db): IntelligenceWorkerDependencies {
  const repository = new SupabaseIntelligenceRepository(db);
  const rssHub = getRssHubClientFromEnv();
  const changedetection = getChangeDetectionClientFromEnv();

  return {
    async listActiveSources() {
      const { data, error } = await db
        .from("content_sources")
        .select("id,organization_id,provider,status,configuration")
        .eq("status", "active")
        .in("provider", ["rsshub", "changedetection"])
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw new Error("Content source listing failed");
      return (data ?? []).map(sourceFromRow);
    },
    async collect(source) {
      const provider = source.provider === "rsshub"
        ? rssHub
          ? new RSSHubIntelligenceProvider({
            client: rssHub,
            resolveSource: async ({ organizationId, sourceId }) => {
              const current = await repository.findSource(organizationId, sourceId);
              const route = current ? stringConfig(current.configuration, "route") : null;
              const sourceUrl = current ? stringConfig(current.configuration, "sourceUrl", "source_url") : null;
              return current?.provider === "rsshub" && route && sourceUrl
                ? { id: current.id, route, sourceUrl }
                : null;
            },
          })
          : null
        : source.provider === "changedetection" && changedetection
          ? new ChangeDetectionIntelligenceProvider({
            client: changedetection,
            resolveSource: async ({ organizationId, sourceId }) => {
              const current = await repository.findSource(organizationId, sourceId);
              const watchId = current ? stringConfig(current.configuration, "watchId", "watch_id", "providerMonitorId", "provider_monitor_id") : null;
              const sourceUrl = current ? stringConfig(current.configuration, "sourceUrl", "source_url", "targetUrl", "target_url") : null;
              return current?.provider === "changedetection" && watchId && sourceUrl
                ? { id: current.id, watchId, sourceUrl }
                : null;
            },
          })
          : null;

      if (!provider) throw new ProviderNotConfiguredError();
      const service = new ContentCollectionService(repository, { get: (name) => name === source.provider ? provider : undefined });
      const collection = await service.collect({ organizationId: source.organizationId, sourceId: source.id });
      const { error } = await db
        .from("content_sources")
        .update({ last_collected_at: new Date().toISOString() })
        .eq("organization_id", source.organizationId)
        .eq("id", source.id);
      if (error) throw new Error("Content source checkpoint failed");
      return collection;
    },
  };
}
