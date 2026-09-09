import { createHash } from 'node:crypto';

import type { LearningScope } from './contracts';
import {
  learningSignalWeight,
  type LearningSignal,
  type LearningSignalKind,
} from './signals';

export interface ClusterThresholds {
  minOccurrences: number;
  minConfidence: number;
  windowMs: number;
  minImpact: number;
}

export interface LearningCluster {
  id: string;
  scope: LearningScope;
  failureType: LearningSignalKind;
  occurrences: number;
  confidence: number;
  impact: number;
  signalRefs: string[];
  firstObservedAt: string;
  lastObservedAt: string;
}

export interface AggregatedLearningSignal {
  anonymizedKey: string;
  failureType: LearningSignalKind;
  occurrences: number;
  confidence: number;
  impact: number;
  firstObservedAt: string;
  lastObservedAt: string;
}

function validateThresholds(thresholds: ClusterThresholds): void {
  if (
    !Number.isInteger(thresholds.minOccurrences) ||
    thresholds.minOccurrences < 1 ||
    !Number.isFinite(thresholds.minConfidence) ||
    thresholds.minConfidence < 0 ||
    thresholds.minConfidence > 1 ||
    !Number.isFinite(thresholds.minImpact) ||
    thresholds.minImpact < 0 ||
    thresholds.minImpact > 1 ||
    !Number.isFinite(thresholds.windowMs) ||
    thresholds.windowMs <= 0
  ) {
    throw new Error('flywheel_cluster_thresholds_invalid');
  }
}

function clusterId(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

function rounded(value: number): number {
  return Number(value.toFixed(6));
}

export function clusterLearningSignals(
  signals: readonly LearningSignal[],
  thresholds: ClusterThresholds,
  nowMs: number,
): LearningCluster[] {
  validateThresholds(thresholds);
  if (!Number.isFinite(nowMs)) throw new Error('flywheel_cluster_now_invalid');

  const cutoff = nowMs - thresholds.windowMs;
  const groups = new Map<string, LearningSignal[]>();

  for (const signal of signals) {
    const observedMs = Date.parse(signal.observedAt);
    if (!Number.isFinite(observedMs) || observedMs < cutoff || observedMs > nowMs) continue;
    const key = [
      signal.scope.organizationId,
      signal.scope.agentId,
      signal.scope.capabilityId,
      signal.kind,
      signal.fingerprint,
    ].join('|');
    const current = groups.get(key) ?? [];
    current.push(signal);
    groups.set(key, current);
  }

  const clusters: LearningCluster[] = [];
  for (const [key, grouped] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (grouped.length < thresholds.minOccurrences) continue;

    const weighted = grouped.map((signal) => ({
      signal,
      weight: learningSignalWeight(signal.kind),
    }));
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    const confidence =
      totalWeight === 0
        ? 0
        : weighted.reduce((sum, item) => sum + item.signal.confidence * item.weight, 0) /
          totalWeight;
    const impact =
      totalWeight === 0
        ? 0
        : weighted.reduce((sum, item) => sum + item.signal.impact * item.weight, 0) /
          totalWeight;

    if (confidence < thresholds.minConfidence || impact < thresholds.minImpact) continue;

    const ordered = [...grouped].sort(
      (a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt) || a.id.localeCompare(b.id),
    );
    const first = ordered[0]!;
    const last = ordered[ordered.length - 1]!;
    clusters.push({
      id: clusterId(key),
      scope: { ...first.scope },
      failureType: first.kind,
      occurrences: grouped.length,
      confidence: rounded(confidence),
      impact: rounded(impact),
      signalRefs: [...new Set(grouped.map((signal) => signal.evidenceRef))].sort(),
      firstObservedAt: first.observedAt,
      lastObservedAt: last.observedAt,
    });
  }

  return clusters.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Cross-tenant/global clustering accepts only pre-anonymized aggregates. Raw
 * LearningSignal rows deliberately cannot be passed to this helper's type.
 */
export function clusterAggregatedLearningSignals(
  aggregates: readonly AggregatedLearningSignal[],
  thresholds: Omit<ClusterThresholds, 'windowMs'>,
): AggregatedLearningSignal[] {
  if (
    !Number.isInteger(thresholds.minOccurrences) ||
    thresholds.minOccurrences < 1 ||
    thresholds.minConfidence < 0 ||
    thresholds.minConfidence > 1 ||
    thresholds.minImpact < 0 ||
    thresholds.minImpact > 1
  ) {
    throw new Error('flywheel_cluster_thresholds_invalid');
  }
  return aggregates
    .filter(
      (aggregate) =>
        aggregate.anonymizedKey.length > 0 &&
        aggregate.occurrences >= thresholds.minOccurrences &&
        aggregate.confidence >= thresholds.minConfidence &&
        aggregate.impact >= thresholds.minImpact,
    )
    .map((aggregate) => ({ ...aggregate }))
    .sort((a, b) =>
      `${a.anonymizedKey}|${a.failureType}`.localeCompare(`${b.anonymizedKey}|${b.failureType}`),
    );
}
