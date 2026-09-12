import { describe, expect, it } from 'vitest';

import { ContentProvenanceTracker, type ContentProvenanceInput } from './content-provenance';

const piece = (overrides: Partial<ContentProvenanceInput> = {}): ContentProvenanceInput => ({
  contentId: 'content-1',
  skill: 'SEO',
  content: 'Título otimizado para pesquisa orgânica',
  source: 'briefing-2026-09-13',
  freshness: 'current',
  confidence: 0.92,
  generatedAt: '2026-09-13T10:00:00.000Z',
  ...overrides,
});

describe('ContentProvenanceTracker', () => {
  it('records source, freshness and confidence for generated marketing content', () => {
    const tracker = new ContentProvenanceTracker();
    const recorded = tracker.record(piece());

    expect(recorded).toEqual(piece());
    expect(tracker.get('content-1')).toEqual(piece());
  });

  it('rejects missing source or confidence outside the 0..1 range', () => {
    const tracker = new ContentProvenanceTracker();

    expect(() => tracker.record(piece({ source: '' }))).toThrow('source is required');
    expect(() => tracker.record(piece({ confidence: 1.1 }))).toThrow('confidence must be between 0 and 1');
  });

  it('rejects duplicate content ids to preserve a single provenance record', () => {
    const tracker = new ContentProvenanceTracker();
    tracker.record(piece());

    expect(() => tracker.record(piece({ skill: 'AEO' }))).toThrow(
      'content provenance already registered: content-1',
    );
  });
});
