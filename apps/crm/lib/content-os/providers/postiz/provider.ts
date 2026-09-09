import { checkProviderHealth } from "@/lib/content-os/providers/health";
import type { DistributionProvider, DistributionPublishInput, DistributionResult } from "@/lib/content-os/providers/distribution";
import type { ProviderHealth, ProviderJobState } from "@/lib/content-os/providers/types";
import type { PostizClient } from "./client";

export class PostizDistributionProvider implements DistributionProvider {
  readonly provider = "postiz";
  constructor(private readonly client: PostizClient) {}

  async connect(organizationId: string, input: Record<string, unknown>) {
    return this.client.connect(organizationId, input);
  }

  async publish(input: DistributionPublishInput): Promise<DistributionResult> {
    const result = await this.client.publish({
      organizationId: input.organizationId,
      idempotencyKey: input.idempotencyKey,
      contentId: input.contentId,
      integrationId: input.connectionId,
      ...(input.scheduledFor ? { scheduledAt: input.scheduledFor } : {}),
    });
    return this.map(result);
  }

  async status(providerPublicationId: string): Promise<DistributionResult> {
    return this.map(await this.client.status(providerPublicationId));
  }

  metrics(providerPublicationId: string): Promise<Record<string, number>> {
    return this.client.metrics(providerPublicationId);
  }

  health(): Promise<ProviderHealth> {
    return checkProviderHealth(() => this.client.health());
  }

  private map(result: { providerPublicationId: string; state: string; publishedUrl?: string }): DistributionResult {
    const state = normalizeState(result.state);
    return { provider: this.provider, providerPublicationId: result.providerPublicationId, state, ...(result.publishedUrl ? { publishedUrl: result.publishedUrl } : {}) };
  }
}

function normalizeState(value: string): ProviderJobState {
  const normalized = value.toLowerCase().replace(/[- ]/g, "_");
  if (["queued", "pending", "draft", "scheduled", "waiting"].includes(normalized)) return "queued";
  if (["running", "processing", "publishing"].includes(normalized)) return "running";
  if (["succeeded", "success", "published", "completed", "sent"].includes(normalized)) return "succeeded";
  if (["failed", "error", "rejected"].includes(normalized)) return "failed";
  if (["cancelled", "canceled"].includes(normalized)) return "cancelled";
  throw new Error("Postiz returned an unknown publication state");
}
