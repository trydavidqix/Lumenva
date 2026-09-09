import type { CreativeJobRef } from "@/lib/content-os/providers/creative";
import type { ProviderHealth } from "@/lib/content-os/providers/types";

export type VideoComposeInput = {
  organizationId: string;
  idempotencyKey: string;
  scriptId: string;
  format: "9:16" | "1:1" | "16:9";
  assetIds: string[];
  voice?: string;
  subtitlePreset?: string;
  musicAssetId?: string;
};

export interface VideoComposer {
  readonly provider: string;
  compose(input: VideoComposeInput): Promise<CreativeJobRef>;
  status(providerJobId: string): Promise<CreativeJobRef>;
  cancel(providerJobId: string): Promise<void>;
  health(): Promise<ProviderHealth>;
}
