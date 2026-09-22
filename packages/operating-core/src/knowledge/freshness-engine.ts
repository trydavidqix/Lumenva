import { SourceRegistry, SourceStatus } from './source-registry.js';
import { KnowledgeCard } from './knowledge-cards.js';

export interface FreshnessConfig {
  checkIntervalHours: number;
  alertThresholdDays: number;
}

export interface KnowledgeUpdate {
  source_id: string;
  previous_version: string;
  new_version: string;
  diff_summary: string;
  impacted_cards: string[];
}

/**
 * Checks a specific source against the external authority to see if it's CURRENT, CHANGED, STALE, etc.
 */
export async function checkSourceFreshness(
  source: SourceRegistry,
  config: FreshnessConfig
): Promise<SourceStatus> {
  // Stub implementation
  // Would query the vendor/authority and diff versions
  return 'CURRENT';
}

/**
 * Runs daily/weekly (based on config) to diff versions and create Knowledge Updates.
 */
export async function runFreshnessEngine(
  registry: SourceRegistry[],
  cards: KnowledgeCard[],
  config: FreshnessConfig
): Promise<KnowledgeUpdate[]> {
  const updates: KnowledgeUpdate[] = [];

  for (const source of registry) {
    const status = await checkSourceFreshness(source, config);
    
    if (status === 'CHANGED' || status === 'STALE') {
      const impactedCards = cards
        .filter(card => card.source_id === source.source_id)
        .map(card => card.id);

      updates.push({
        source_id: source.source_id,
        previous_version: source.version,
        new_version: 'pending_fetch', // Stub new version
        diff_summary: `Source ${source.source_id} changed or became stale.`,
        impacted_cards: impactedCards,
      });
    }
  }

  return updates;
}
