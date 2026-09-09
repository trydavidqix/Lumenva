import type { ProviderHealth } from "@/lib/content-os/providers/types";

export type IntelligenceCollectInput = {
  organizationId: string;
  sourceId: string;
  cursor?: string;
  limit?: number;
};

export type RawSignal = {
  externalId: string;
  sourceType: string;
  sourceUrl: string;
  title?: string;
  body?: string;
  publishedAt?: string;
  observedAt: string;
  rawHash: string;
  metadata: Record<string, unknown>;
};

export interface IntelligenceProvider {
  readonly provider: string;
  collect(input: IntelligenceCollectInput): Promise<RawSignal[]>;
  health(): Promise<ProviderHealth>;
}
