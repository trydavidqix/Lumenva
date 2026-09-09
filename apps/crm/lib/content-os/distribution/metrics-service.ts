export const canonicalMetricNames = ["impressions", "views", "reach", "likes", "comments", "shares", "saves", "clicks"] as const;
export type CanonicalMetricName = (typeof canonicalMetricNames)[number];
export type NormalizedMetrics = Partial<Record<CanonicalMetricName, number>>;
export type PublicationMetricSnapshot = { organization_id: string; publication_job_id: string; provider_ref: string | null; captured_at: string; metrics: NormalizedMetrics; source_version: string | null };

export type MetricsRepository = {
  findPublication(organizationId: string, publicationJobId: string): Promise<{ id: string; providerPublicationId: string | null; state: string } | null>;
  upsertSnapshot(snapshot: PublicationMetricSnapshot): Promise<PublicationMetricSnapshot>;
};

export type MetricsProvider = { metrics(providerPublicationId: string): Promise<Record<string, number>> };
export class MetricsValidationError extends Error { readonly code = "metrics_invalid"; }

const aliases: Record<CanonicalMetricName, readonly string[]> = {
  impressions: ["impressions", "impression", "views_count"], views: ["views", "view", "video_views"], reach: ["reach", "unique_reach"], likes: ["likes", "like", "reactions", "reaction"], comments: ["comments", "comment"], shares: ["shares", "share"], saves: ["saves", "save", "bookmarks"], clicks: ["clicks", "click", "link_clicks"],
};

export function normalizeMetrics(raw: Record<string, number>): NormalizedMetrics {
  const result: NormalizedMetrics = {};
  for (const name of canonicalMetricNames) {
    const key = aliases[name].find((candidate) => typeof raw[candidate] === "number" && Number.isFinite(raw[candidate]) && raw[candidate] >= 0);
    if (key) result[name] = raw[key];
  }
  return result;
}

export async function collectPublicationMetrics(repository: MetricsRepository, provider: MetricsProvider, input: { organizationId: string; publicationJobId: string; capturedAt?: string; sourceVersion?: string | null }): Promise<PublicationMetricSnapshot> {
  if (!input.organizationId.trim() || !input.publicationJobId.trim()) throw new MetricsValidationError("Organization and publication job are required.");
  const publication = await repository.findPublication(input.organizationId, input.publicationJobId);
  if (!publication) throw new MetricsValidationError("Publication job not found.");
  if (!publication.providerPublicationId || publication.state !== "succeeded") throw new MetricsValidationError("Publication has no confirmed provider reference.");
  const metrics = normalizeMetrics(await provider.metrics(publication.providerPublicationId));
  return repository.upsertSnapshot({ organization_id: input.organizationId, publication_job_id: input.publicationJobId, provider_ref: publication.providerPublicationId, captured_at: input.capturedAt ?? new Date().toISOString(), metrics, source_version: input.sourceVersion ?? null });
}
