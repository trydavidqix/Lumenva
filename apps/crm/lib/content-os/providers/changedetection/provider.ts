import { createHash } from "node:crypto";

import { checkProviderHealth } from "@/lib/content-os/providers/health";
import type {
  IntelligenceCollectInput,
  IntelligenceProvider,
  RawSignal,
} from "@/lib/content-os/providers/intelligence";
import type { ProviderHealth } from "@/lib/content-os/providers/types";

import type { ChangeDetectionClient } from "./client";

export type ChangeDetectionSourceDefinition = {
  id: string;
  /** Remote watch created and owned by the server-side competitor service. */
  watchId: string;
  sourceUrl: string;
};

export type ChangeDetectionIntelligenceProviderOptions = {
  client: ChangeDetectionClient;
  resolveSource: (
    input: Pick<IntelligenceCollectInput, "organizationId" | "sourceId">,
  ) => Promise<ChangeDetectionSourceDefinition | null>;
  now?: () => Date;
};

export class ChangeDetectionIntelligenceProvider implements IntelligenceProvider {
  readonly provider = "changedetection";

  private readonly now: () => Date;

  constructor(private readonly options: ChangeDetectionIntelligenceProviderOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async collect(input: IntelligenceCollectInput): Promise<RawSignal[]> {
    const source = await this.options.resolveSource({
      organizationId: input.organizationId,
      sourceId: input.sourceId,
    });
    if (!source || source.id !== input.sourceId) {
      throw new Error("changedetection.io source is not available");
    }

    const [watch, history] = await Promise.all([
      this.options.client.getWatch(source.watchId),
      this.options.client.getHistory(source.watchId),
    ]);
    const latestTimestamp = latestHistoryTimestamp(history);
    if (!latestTimestamp) return [];

    const snapshot = await this.options.client.getLatestSnapshot(source.watchId);
    const observedAt = this.now().toISOString();
    const sourceUrl = watch.link ?? watch.url ?? source.sourceUrl;
    const externalId = `${source.watchId}:${latestTimestamp}`;

    return [
      {
        externalId,
        sourceType: "changedetection",
        sourceUrl,
        title: watch.title ?? watch.page_title,
        body: snapshot,
        publishedAt: new Date(Number(latestTimestamp) * 1_000).toISOString(),
        observedAt,
        rawHash: createHash("sha256")
          .update(JSON.stringify({ externalId, snapshot }), "utf8")
          .digest("hex"),
        metadata: {
          watchId: source.watchId,
          changeTimestamp: latestTimestamp,
        },
      },
    ];
  }

  health(): Promise<ProviderHealth> {
    return checkProviderHealth(() => this.options.client.health());
  }
}

function latestHistoryTimestamp(history: Record<string, string>): string | null {
  const timestamps = Object.keys(history).filter((timestamp) =>
    Number.isFinite(Number(timestamp)),
  );
  if (timestamps.length === 0) return null;

  return timestamps.sort((left, right) => Number(right) - Number(left))[0] ?? null;
}
