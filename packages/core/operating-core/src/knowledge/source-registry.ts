export type SourceStatus = 'CURRENT' | 'CHANGED' | 'STALE' | 'DEPRECATED' | 'OFFLINE' | 'UNVERIFIED';

export interface SourceRegistry {
  source_id: string;
  vendor: string;
  product: string;
  authority: string;
  version: string;
  release_channel: string;
  topics: string[];
  retrieved_at: string;
  freshness: number;
  status: SourceStatus;
}
