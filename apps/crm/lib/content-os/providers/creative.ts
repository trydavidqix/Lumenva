import type { ProviderHealth, ProviderJobRef } from "@/lib/content-os/providers/types";

export type CreativeGenerateInput = {
  organizationId: string;
  idempotencyKey: string;
  workflow: string;
  parameters: Record<string, unknown>;
  sourceAssetIds?: string[];
};

export type CreativeJobRef = ProviderJobRef;

export interface CreativeProvider {
  readonly provider: string;
  generate(input: CreativeGenerateInput): Promise<CreativeJobRef>;
  status(providerJobId: string): Promise<CreativeJobRef>;
  cancel(providerJobId: string): Promise<void>;
  health(): Promise<ProviderHealth>;
}
