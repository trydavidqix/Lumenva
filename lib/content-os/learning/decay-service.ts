/**
 * Deterministic content-decay detection.
 *
 * This module deliberately has no provider or database dependency.  A caller
 * supplies tenant-scoped rows from `content_items` and `publication_metrics`;
 * the result can then be persisted as a `content_learning_events` row by the
 * update service.  Cumulative provider counters are compared at two points in
 * time, so a missing metric is never treated as zero.
 */

export type LearningContentItem = {
  id: string;
  organizationId: string;
  title: string;
  contentType: string;
  status: string;
  publishedAt: string | null;
  updatedAt?: string | null;
};

export type LearningMetricSnapshot = {
  organizationId: string;
  contentItemId: string;
  capturedAt: string;
  metrics: {
    impressions?: number;
    views?: number;
    reach?: number;
    clicks?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
  };
};

export type DecayPolicy = {
  /** Ignore content until it has had enough time to accumulate a baseline. */
  minAgeDays: number;
  /** Compare the latest snapshot with the last snapshot before this window. */
  comparisonWindowDays: number;
  /** Do not make decisions from a sample that is too small. */
  minBaselineValue: number;
  /** A 0.35 value means a 35% decline is required. */
  minimumRelativeDrop: number;
  /** Avoid duplicate candidates for the same observed snapshot. */
  idempotencyPrefix?: string;
};

export const defaultDecayPolicy: Readonly<DecayPolicy> = {
  minAgeDays: 30,
  comparisonWindowDays: 28,
  minBaselineValue: 100,
  minimumRelativeDrop: 0.35,
  idempotencyPrefix: "content-decay",
};

export type DecayCandidate = {
  organizationId: string;
  contentItemId: string;
  title: string;
  reason: "performance_decay";
  severity: "medium" | "high";
  idempotencyKey: string;
  detectedAt: string;
  baseline: { value: number; capturedAt: string; metric: string };
  current: { value: number; capturedAt: string; metric: string };
  relativeDrop: number;
  metadata: {
    contentType: string;
    policy: Pick<DecayPolicy, "minAgeDays" | "comparisonWindowDays" | "minBaselineValue" | "minimumRelativeDrop">;
  };
};

export type DecayRepository = {
  listPublishedContent(organizationId: string): Promise<LearningContentItem[]>;
  listMetricSnapshots(organizationId: string, contentItemIds: string[]): Promise<LearningMetricSnapshot[]>;
};

export class DecayValidationError extends Error {
  readonly code = "content_decay_invalid";
}

type MetricPoint = { metric: string; value: number };

const metricPriority = ["impressions", "views", "reach"] as const;

function assertPolicy(policy: DecayPolicy): void {
  if (!Number.isFinite(policy.minAgeDays) || policy.minAgeDays < 0) throw new DecayValidationError("minAgeDays must be non-negative");
  if (!Number.isFinite(policy.comparisonWindowDays) || policy.comparisonWindowDays <= 0) throw new DecayValidationError("comparisonWindowDays must be positive");
  if (!Number.isFinite(policy.minBaselineValue) || policy.minBaselineValue <= 0) throw new DecayValidationError("minBaselineValue must be positive");
  if (!Number.isFinite(policy.minimumRelativeDrop) || policy.minimumRelativeDrop <= 0 || policy.minimumRelativeDrop >= 1) throw new DecayValidationError("minimumRelativeDrop must be between 0 and 1");
}

function metricPoint(snapshot: LearningMetricSnapshot): MetricPoint | null {
  for (const metric of metricPriority) {
    const value = snapshot.metrics[metric];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return { metric, value };
  }
  return null;
}

function parseDate(value: string, field: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new DecayValidationError(`${field} must be an ISO date`);
  return timestamp;
}

/** Evaluates one item without I/O; useful for deterministic tests and previews. */
export function evaluateDecay(
  item: LearningContentItem,
  snapshots: readonly LearningMetricSnapshot[],
  options: { now?: string; policy?: Partial<DecayPolicy> } = {},
): DecayCandidate | null {
  const policy: DecayPolicy = { ...defaultDecayPolicy, ...options.policy };
  assertPolicy(policy);
  if (!item.organizationId.trim() || !item.id.trim()) throw new DecayValidationError("Content item and organization are required");
  if (item.status !== "published" || !item.publishedAt) return null;

  const now = options.now ?? new Date().toISOString();
  const nowMs = parseDate(now, "now");
  const publishedMs = parseDate(item.publishedAt, "publishedAt");
  if (publishedMs > nowMs) return null;
  const ageDays = (nowMs - publishedMs) / 86_400_000;
  if (ageDays < policy.minAgeDays) return null;

  const relevant = snapshots
    .filter((snapshot) => snapshot.organizationId === item.organizationId && snapshot.contentItemId === item.id)
    .map((snapshot) => ({ snapshot, timestamp: parseDate(snapshot.capturedAt, "capturedAt"), point: metricPoint(snapshot) }))
    .filter((entry): entry is typeof entry & { point: MetricPoint } => entry.point !== null && entry.timestamp <= nowMs)
    .sort((a, b) => a.timestamp - b.timestamp);
  const latest = relevant.at(-1);
  if (!latest) return null;
  const windowStart = nowMs - policy.comparisonWindowDays * 86_400_000;
  // Include a snapshot exactly on the boundary: providers commonly capture
  // on a fixed daily schedule and excluding it would create an artificial
  // gap (and unexpectedly select an older baseline).
  const baseline = relevant.filter((entry) => entry.timestamp <= windowStart).at(-1);
  if (!baseline || baseline.point.metric !== latest.point.metric || baseline.point.value < policy.minBaselineValue) return null;
  if (latest.point.value >= baseline.point.value) return null;

  const relativeDrop = (baseline.point.value - latest.point.value) / baseline.point.value;
  if (relativeDrop < policy.minimumRelativeDrop) return null;
  const detectedAt = new Date(nowMs).toISOString();
  const observedAt = new Date(latest.timestamp).toISOString();
  const prefix = policy.idempotencyPrefix?.trim() || defaultDecayPolicy.idempotencyPrefix!;
  return {
    organizationId: item.organizationId,
    contentItemId: item.id,
    title: item.title,
    reason: "performance_decay",
    severity: relativeDrop >= 0.6 ? "high" : "medium",
    idempotencyKey: `${prefix}:${item.organizationId}:${item.id}:${observedAt}`,
    detectedAt,
    baseline: { value: baseline.point.value, capturedAt: new Date(baseline.timestamp).toISOString(), metric: baseline.point.metric },
    current: { value: latest.point.value, capturedAt: observedAt, metric: latest.point.metric },
    relativeDrop,
    metadata: {
      contentType: item.contentType,
      policy: {
        minAgeDays: policy.minAgeDays,
        comparisonWindowDays: policy.comparisonWindowDays,
        minBaselineValue: policy.minBaselineValue,
        minimumRelativeDrop: policy.minimumRelativeDrop,
      },
    },
  };
}

export async function detectContentDecay(
  repository: DecayRepository,
  input: { organizationId: string; now?: string; policy?: Partial<DecayPolicy> },
): Promise<DecayCandidate[]> {
  if (!input.organizationId.trim()) throw new DecayValidationError("Organization is required");
  const policy = { ...defaultDecayPolicy, ...input.policy };
  assertPolicy(policy);
  const items = (await repository.listPublishedContent(input.organizationId)).filter((item) => item.organizationId === input.organizationId);
  if (!items.length) return [];
  const snapshots = await repository.listMetricSnapshots(input.organizationId, items.map((item) => item.id));
  return items.map((item) => evaluateDecay(item, snapshots, { now: input.now, policy })).filter((candidate): candidate is DecayCandidate => candidate !== null);
}
