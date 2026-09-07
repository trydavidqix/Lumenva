import { env } from "@/lib/env";

export type PostizClientErrorCode =
  | "invalid_response"
  | "invalid_id"
  | "timeout"
  | "unauthorized"
  | "rate_limited"
  | "unavailable";

/** Safe provider error: intentionally does not retain a response body. */
export class PostizClientError extends Error {
  readonly name = "PostizClientError";

  constructor(readonly code: PostizClientErrorCode) {
    super("Postiz request failed");
  }
}

export type PostizClientOptions = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  fetch?: (input: string | URL, init?: RequestInit) => Promise<Response>;
};

export type PostizConnection = { connectionId: string; redirectUrl?: string };
export type PostizPublication = {
  providerPublicationId: string;
  state: string;
  publishedUrl?: string;
};

const DEFAULT_TIMEOUT_MS = 10_000;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringField(value: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) if (typeof value[key] === "string" && value[key]) return value[key] as string;
  return undefined;
}

function parseConnection(value: unknown): PostizConnection {
  const body = record(value);
  const nested = record(body?.data) ?? body;
  const connectionId = nested ? stringField(nested, "connectionId", "connection_id", "id", "integrationId", "integration_id") : undefined;
  if (!connectionId) throw new PostizClientError("invalid_response");
  const redirectUrl = nested ? stringField(nested, "redirectUrl", "redirect_url", "url") : undefined;
  return { connectionId, ...(redirectUrl ? { redirectUrl } : {}) };
}

function parsePublication(value: unknown): PostizPublication {
  const body = record(value);
  const nested = record(body?.data) ?? body;
  const providerPublicationId = nested ? stringField(nested, "providerPublicationId", "provider_publication_id", "postId", "post_id", "id") : undefined;
  const state = nested ? stringField(nested, "state", "status") : undefined;
  if (!providerPublicationId || !state) throw new PostizClientError("invalid_response");
  const publishedUrl = stringField(nested!, "publishedUrl", "published_url", "url");
  return { providerPublicationId, state, ...(publishedUrl ? { publishedUrl } : {}) };
}

export class PostizClient {
  private readonly baseUrl: URL;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: (input: string | URL, init?: RequestInit) => Promise<Response>;

  constructor(options: PostizClientOptions) {
    const baseUrl = new URL(options.baseUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      throw new TypeError("Postiz base URL must use HTTP(S)");
    }
    baseUrl.search = "";
    baseUrl.hash = "";
    if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
    this.baseUrl = baseUrl;
    this.apiKey = options.apiKey ?? "";
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetch ?? fetch;
  }

  async connect(organizationId: string, input: Record<string, unknown>): Promise<PostizConnection> {
    return parseConnection(await this.json("public/v1/integrations", {
      method: "POST",
      body: { organizationId, ...input },
    }));
  }

  async publish(input: Record<string, unknown>): Promise<PostizPublication> {
    return parsePublication(await this.json("public/v1/posts", { method: "POST", body: input }));
  }

  async status(providerPublicationId: string): Promise<PostizPublication> {
    return parsePublication(await this.json(`public/v1/posts/${this.id(providerPublicationId)}`));
  }

  async metrics(providerPublicationId: string): Promise<Record<string, number>> {
    const value = await this.json(`public/v1/posts/${this.id(providerPublicationId)}/analytics`);
    const body = record(value);
    const nested = record(body?.data) ?? body;
    if (!nested) throw new PostizClientError("invalid_response");
    const metrics: Record<string, number> = {};
    for (const [key, item] of Object.entries(nested)) {
      if (typeof item === "number" && Number.isFinite(item)) metrics[key] = item;
    }
    return metrics;
  }

  async health(): Promise<void> {
    await this.request("health");
  }

  private id(value: string): string {
    if (!value || value.includes("/") || value.includes("\\")) throw new PostizClientError("invalid_id");
    return encodeURIComponent(value);
  }

  private async json(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<unknown> {
    const response = await this.request(path, options);
    try {
      return await response.json();
    } catch {
      throw new PostizClientError("invalid_response");
    }
  }

  private async request(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<Response> {
    try {
      const response = await this.fetchFn(new URL(path, this.baseUrl), {
        method: options.method,
        headers: {
          Accept: "application/json",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (response.ok) return response;
      if (response.status === 401 || response.status === 403) throw new PostizClientError("unauthorized");
      if (response.status === 429) throw new PostizClientError("rate_limited");
      throw new PostizClientError("unavailable");
    } catch (error) {
      if (error instanceof PostizClientError) throw error;
      const name = error instanceof Error ? error.name : "";
      throw new PostizClientError(name === "AbortError" || name === "TimeoutError" ? "timeout" : "unavailable");
    }
  }
}

export function getPostizClientFromEnv(): PostizClient | null {
  if (!env.CONTENT_OS_POSTIZ_BASE_URL) return null;
  return new PostizClient({
    baseUrl: env.CONTENT_OS_POSTIZ_BASE_URL,
    apiKey: env.CONTENT_OS_POSTIZ_API_KEY,
    timeoutMs: env.CONTENT_OS_POSTIZ_TIMEOUT_MS,
  });
}
