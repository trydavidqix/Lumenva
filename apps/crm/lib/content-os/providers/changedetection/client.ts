import { env } from "@/lib/env";

export type ChangeDetectionWatch = {
  uuid: string;
  url?: string;
  link?: string;
  title?: string;
  page_title?: string;
  last_checked?: number;
  last_changed?: number;
};

export type ChangeDetectionWatchInput = {
  url: string;
  title?: string;
  paused?: boolean;
  time_between_check?: Record<string, number>;
};

export type ChangeDetectionClientErrorCode =
  | "invalid_response"
  | "invalid_watch_id"
  | "not_found"
  | "timeout"
  | "unauthorized"
  | "unavailable";

/** Provider errors are safe to persist and display; remote bodies are omitted. */
export class ChangeDetectionClientError extends Error {
  readonly name = "ChangeDetectionClientError";

  constructor(readonly code: ChangeDetectionClientErrorCode) {
    super("changedetection.io request failed");
  }
}

export type ChangeDetectionClientOptions = {
  baseUrl: string;
  apiKey?: string;
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

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toWatch(value: unknown): ChangeDetectionWatch {
  if (!isRecord(value) || typeof value.uuid !== "string") {
    throw new ChangeDetectionClientError("invalid_response");
  }

  return {
    uuid: value.uuid,
    url: optionalString(value.url),
    link: optionalString(value.link),
    title: optionalString(value.title),
    page_title: optionalString(value.page_title),
    last_checked: optionalNumber(value.last_checked),
    last_changed: optionalNumber(value.last_changed),
  };
}

function toHistory(value: unknown): Record<string, string> {
  if (!isRecord(value)) throw new ChangeDetectionClientError("invalid_response");

  const history: Record<string, string> = {};
  for (const [timestamp, snapshotPath] of Object.entries(value)) {
    if (typeof snapshotPath === "string") history[timestamp] = snapshotPath;
  }
  return history;
}

export class ChangeDetectionClient {
  private readonly baseUrl: URL;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: ChangeDetectionClientOptions) {
    const baseUrl = new URL(options.baseUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      throw new TypeError("changedetection.io base URL must use HTTP(S)");
    }

    baseUrl.search = "";
    baseUrl.hash = "";
    if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";

    this.baseUrl = new URL("api/v1/", baseUrl);
    this.apiKey = options.apiKey ?? "";
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchFn = options.fetch ?? fetch;
  }

  async createWatch(input: ChangeDetectionWatchInput): Promise<string> {
    const response = await this.request("watch", { method: "POST", body: input });
    const created = await this.readJson(response, (value) => {
      if (!isRecord(value) || typeof value.uuid !== "string") {
        throw new ChangeDetectionClientError("invalid_response");
      }
      return value.uuid;
    });

    return created;
  }

  async updateWatch(watchId: string, input: Partial<ChangeDetectionWatchInput>): Promise<void> {
    await this.request(this.watchPath(watchId), { method: "PUT", body: input });
  }

  async deleteWatch(watchId: string): Promise<void> {
    await this.request(this.watchPath(watchId), { method: "DELETE" });
  }

  async getWatch(watchId: string): Promise<ChangeDetectionWatch> {
    const response = await this.request(this.watchPath(watchId));
    return this.readJson(response, toWatch);
  }

  async getHistory(watchId: string): Promise<Record<string, string>> {
    const response = await this.request(`${this.watchPath(watchId)}/history`);
    return this.readJson(response, toHistory);
  }

  async getLatestSnapshot(watchId: string): Promise<string> {
    const response = await this.request(`${this.watchPath(watchId)}/history/latest`);
    return response.text();
  }

  async health(): Promise<void> {
    await this.request("systeminfo");
  }

  private watchPath(watchId: string): string {
    if (!watchId || watchId.includes("/") || watchId.includes("\\")) {
      throw new ChangeDetectionClientError("invalid_watch_id");
    }
    return `watch/${encodeURIComponent(watchId)}`;
  }

  private async readJson<T>(
    response: Response,
    parser: (value: unknown) => T,
  ): Promise<T> {
    try {
      return parser(await response.json());
    } catch (error) {
      if (error instanceof ChangeDetectionClientError) throw error;
      throw new ChangeDetectionClientError("invalid_response");
    }
  }

  private async request(
    path: string,
    options: { method?: "DELETE" | "GET" | "POST" | "PUT"; body?: unknown } = {},
  ): Promise<Response> {
    try {
      const response = await this.fetchFn(new URL(path, this.baseUrl), {
        method: options.method,
        headers: {
          Accept: "application/json, text/plain",
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(this.apiKey ? { "x-api-key": this.apiKey } : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        // Never follow redirects from the provider endpoint; redirect chains can
        // otherwise turn a validated public target into an internal request.
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (response.ok) return response;

      if (response.status === 401 || response.status === 403) {
        throw new ChangeDetectionClientError("unauthorized");
      }
      if (response.status === 404) throw new ChangeDetectionClientError("not_found");
      throw new ChangeDetectionClientError("unavailable");
    } catch (error) {
      if (error instanceof ChangeDetectionClientError) throw error;
      const name = error instanceof Error ? error.name : "";
      throw new ChangeDetectionClientError(
        name === "AbortError" || name === "TimeoutError" ? "timeout" : "unavailable",
      );
    }
  }
}

/** Returns null until the private changedetection.io deployment is configured. */
export function getChangeDetectionClientFromEnv(): ChangeDetectionClient | null {
  if (!env.CONTENT_OS_CHANGEDETECTION_BASE_URL) return null;

  return new ChangeDetectionClient({
    baseUrl: env.CONTENT_OS_CHANGEDETECTION_BASE_URL,
    apiKey: env.CONTENT_OS_CHANGEDETECTION_API_KEY,
  });
}
