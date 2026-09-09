import { createHash } from "node:crypto";

import { checkProviderHealth } from "@/lib/content-os/providers/health";
import type {
  IntelligenceCollectInput,
  IntelligenceProvider,
  RawSignal,
} from "@/lib/content-os/providers/intelligence";
import type { ProviderHealth } from "@/lib/content-os/providers/types";

import type { RssHubClient, RssHubJsonFeedItem } from "./client";

export type RssHubSourceDefinition = {
  id: string;
  /** A catalogued, relative RSSHub route — never a browser supplied URL. */
  route: string;
  /** Public canonical source URL used only when a feed item has no own link. */
  sourceUrl: string;
};

export type RSSHubIntelligenceProviderOptions = {
  client: RssHubClient;
  resolveSource: (
    input: Pick<IntelligenceCollectInput, "organizationId" | "sourceId">,
  ) => Promise<RssHubSourceDefinition | null>;
  now?: () => Date;
};

export class RSSHubIntelligenceProvider implements IntelligenceProvider {
  readonly provider = "rsshub";

  private readonly now: () => Date;

  constructor(private readonly options: RSSHubIntelligenceProviderOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async collect(input: IntelligenceCollectInput): Promise<RawSignal[]> {
    const source = await this.options.resolveSource({
      organizationId: input.organizationId,
      sourceId: input.sourceId,
    });

    if (!source || source.id !== input.sourceId) {
      throw new Error("RSSHub source is not available");
    }

    const feed = await this.options.client.fetchFeed(source.route);
    const limit = input.limit === undefined ? undefined : Math.max(0, input.limit);
    const items = limit === undefined ? feed.items : feed.items.slice(0, limit);
    const observedAt = this.now().toISOString();

    return items.map((item) =>
      this.toRawSignal(item, source.sourceUrl, observedAt),
    );
  }

  health(): Promise<ProviderHealth> {
    return checkProviderHealth(() => this.options.client.health());
  }

  private toRawSignal(
    item: RssHubJsonFeedItem,
    fallbackUrl: string,
    observedAt: string,
  ): RawSignal {
    const sourceUrl = item.url ?? item.external_url ?? fallbackUrl;
    const externalId =
      item.id ??
      sourceUrl ??
      createHash("sha256")
        .update(JSON.stringify(item), "utf8")
        .digest("hex");

    return {
      externalId,
      sourceType: "rsshub",
      sourceUrl,
      title: item.title,
      body: item.content_text ?? item.summary ?? item.content_html,
      publishedAt: toIsoTimestamp(item.date_published ?? item.date_modified),
      observedAt,
      rawHash: createHash("sha256")
        .update(JSON.stringify({ externalId, item }), "utf8")
        .digest("hex"),
      metadata: {
        feedItemId: item.id ?? null,
      },
    };
  }
}

function toIsoTimestamp(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp.toISOString();
}
