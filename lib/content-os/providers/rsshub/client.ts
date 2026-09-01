import { env } from "@/lib/env";

export type RssHubJsonFeedItem = {
  id?: string;
  url?: string;
  external_url?: string;
  title?: string;
  content_text?: string;
  content_html?: string;
  summary?: string;
  date_published?: string;
  date_modified?: string;
};

export type RssHubJsonFeed = {
  title?: string;
  home_page_url?: string;
  items: RssHubJsonFeedItem[];
};

export type RssHubClientErrorCode =
  | "invalid_response"
  | "invalid_route"
  | "timeout"
  | "unauthorized"
  | "unavailable";

/** Error contract deliberately excludes remote response bodies and credentials. */
export class RssHubClientError extends Error {
  readonly name = "RssHubClientError";

  constructor(readonly code: RssHubClientErrorCode) {
    super("RSSHub request failed");
  }
}

export type RssHubClientOptions = {
  baseUrl: string;
  accessKey?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

const DEFAULT_TIMEOUT_MS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toFeedItem(value: unknown): RssHubJsonFeedItem {
  if (!isRecord(value)) return {};

  return {
    id: optionalString(value.id),
    url: optionalString(value.url),
    external_url: optionalString(value.external_url),
    title: optionalString(value.title),
    content_text: optionalString(value.content_text),
    content_html: optionalString(value.content_html),
    summary: optionalString(value.summary),
    date_published: optionalString(value.date_published),
    date_modified: optionalString(value.date_modified),
  };
}

function toFeed(value: unknown): RssHubJsonFeed {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new RssHubClientError("invalid_response");
  }

  return {
    title: optionalString(value.title),
    home_page_url: optionalString(value.home_page_url),
    items: value.items.map(toFeedItem),
  };
}

export class RssHubClient {
  private readonly baseUrl: URL;
  private readonly accessKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: RssHubClientOptions) {
    const baseUrl = new URL(options.baseUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      throw new TypeError("RSSHub base URL must use HTTP(S)");
    }

    baseUrl.search = "";
    baseUrl.hash = "";
    if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";

    this.baseUrl = baseUrl;
    this.accessKey = options.accessKey ?? "";
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetch ?? fetch;
  }

  async fetchFeed(route: string): Promise<RssHubJsonFeed> {
    const url = this.feedUrl(route);
    const response = await this.request(url);

    try {
      return toFeed(await response.json());
    } catch (error) {
      if (error instanceof RssHubClientError) throw error;
      throw new RssHubClientError("invalid_response");
    }
  }

  async health(): Promise<void> {
    await this.request(new URL("./", this.baseUrl));
  }

  private feedUrl(route: string): URL {
    if (!route.startsWith("/") || route.startsWith("//")) {
      throw new RssHubClientError("invalid_route");
    }

    const relativeRoute = route.slice(1);
    const pathname = relativeRoute.split("?", 1)[0] ?? "";
    if (
      pathname.split("/").some((segment) => segment === "." || segment === "..")
    ) {
      throw new RssHubClientError("invalid_route");
    }

    const url = new URL(relativeRoute, this.baseUrl);
    if (url.origin !== this.baseUrl.origin) {
      throw new RssHubClientError("invalid_route");
    }

    url.searchParams.set("format", "json");
    return url;
  }

  private async request(url: URL): Promise<Response> {
    try {
      const response = await this.fetchFn(url, {
        headers: {
          Accept: "application/feed+json, application/json",
          ...(this.accessKey
            ? { "X-Content-OS-Access-Key": this.accessKey }
            : {}),
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (response.ok) return response;

      throw new RssHubClientError(
        response.status === 401 || response.status === 403
          ? "unauthorized"
          : "unavailable",
      );
    } catch (error) {
      if (error instanceof RssHubClientError) throw error;

      const name = error instanceof Error ? error.name : "";
      throw new RssHubClientError(
        name === "AbortError" || name === "TimeoutError" ? "timeout" : "unavailable",
      );
    }
  }
}

/** Returns null until the private RSSHub deployment is explicitly configured. */
export function getRssHubClientFromEnv(): RssHubClient | null {
  if (!env.CONTENT_OS_RSSHUB_BASE_URL) return null;

  return new RssHubClient({
    baseUrl: env.CONTENT_OS_RSSHUB_BASE_URL,
    accessKey: env.CONTENT_OS_RSSHUB_ACCESS_KEY,
  });
}
