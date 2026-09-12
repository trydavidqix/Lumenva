import {
  type ContentFreshness,
  type ContentProvenanceInput,
  ContentProvenanceTracker,
} from './content-provenance';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Revalidates tracker records and persists current/stale state. */
export class FreshnessEngine {
  constructor(private readonly tracker: ContentProvenanceTracker) {}

  run(now: Date, maxAgeDays: number): ContentProvenanceInput[] {
    if (!Number.isFinite(maxAgeDays) || maxAgeDays < 0) {
      throw new Error('maxAgeDays must be a non-negative finite number');
    }
    const nowMs = now.getTime();
    for (const record of this.tracker.list()) {
      const generatedMs = Date.parse(record.generatedAt);
      const freshness: ContentFreshness = Number.isFinite(nowMs)
        && Number.isFinite(generatedMs)
        && generatedMs <= nowMs
        && nowMs - generatedMs < maxAgeDays * DAY_MS
        ? 'current'
        : 'stale';
      this.tracker.updateFreshness(record.contentId, freshness);
    }
    return this.tracker.list();
  }
}
