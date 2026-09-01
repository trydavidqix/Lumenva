import type { ProviderHealth, ProviderJobState } from "@/lib/content-os/providers/types";

export type DistributionPublishInput = {
  organizationId: string;
  idempotencyKey: string;
  contentId: string;
  connectionId: string;
  scheduledFor?: string;
};

export type DistributionResult = {
  provider: string;
  providerPublicationId: string;
  state: ProviderJobState;
  publishedUrl?: string;
};

export interface DistributionProvider {
  readonly provider: string;
  connect(
    organizationId: string,
    input: Record<string, unknown>,
  ): Promise<{ connectionId: string; redirectUrl?: string }>;
  publish(input: DistributionPublishInput): Promise<DistributionResult>;
  status(providerPublicationId: string): Promise<DistributionResult>;
  metrics(providerPublicationId: string): Promise<Record<string, number>>;
  health(): Promise<ProviderHealth>;
}
