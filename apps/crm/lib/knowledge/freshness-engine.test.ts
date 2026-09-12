import { describe, expect, it } from 'vitest';

import { ContentProvenanceTracker, type ContentProvenanceInput } from './content-provenance';
import { FreshnessEngine } from './freshness-engine';

const piece = (contentId: string, generatedAt: string): ContentProvenanceInput => ({
  contentId,
  skill: 'SEO',
  content: `conteúdo ${contentId}`,
  source: 'briefing-2026-09-13',
  freshness: 'current',
  confidence: 0.9,
  generatedAt,
});

describe('FreshnessEngine', () => {
  it('marks expired content stale and keeps recently generated content current in the tracker', () => {
    const tracker = new ContentProvenanceTracker();
    tracker.record(piece('fresh', '2026-09-10T12:00:00.000Z'));
    tracker.record(piece('old', '2026-09-01T12:00:00.000Z'));

    const result = new FreshnessEngine(tracker).run(new Date('2026-09-13T12:00:00.000Z'), 7);

    expect(result.map(({ contentId, freshness }) => ({ contentId, freshness }))).toEqual([
      { contentId: 'fresh', freshness: 'current' },
      { contentId: 'old', freshness: 'stale' },
    ]);
    expect(tracker.get('old')?.freshness).toBe('stale');
  });

  it('rejects an invalid freshness window', () => {
    const tracker = new ContentProvenanceTracker();
    expect(() => new FreshnessEngine(tracker).run(new Date(), -1)).toThrow(
      'maxAgeDays must be a non-negative finite number',
    );
  });
});
