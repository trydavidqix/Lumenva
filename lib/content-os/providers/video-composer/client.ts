import { env } from "@/lib/env";

export type VideoComposerClientErrorCode = "invalid_response" | "invalid_id" | "timeout" | "unauthorized" | "rate_limited" | "unavailable";
export class VideoComposerClientError extends Error {
  readonly name = "VideoComposerClientError";
  constructor(readonly code: VideoComposerClientErrorCode) { super("Video Composer request failed"); }
}
export type VideoComposerClientOptions = { baseUrl: string; apiKey?: string; timeoutMs?: number; fetch?: (input: string | URL, init?: RequestInit) => Promise<Response> };
export type ComposerJob = { providerJobId: string; state: string; outputUrl?: string };

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
function parseJob(value: unknown): ComposerJob {
  const body = isRecord(value) ? value : null;
  const nested = isRecord(body?.data) ? body.data : body;
  const id = nested && (typeof nested.providerJobId === "string" ? nested.providerJobId : typeof nested.jobId === "string" ? nested.jobId : typeof nested.id === "string" ? nested.id : undefined);
  const state = nested && (typeof nested.state === "string" ? nested.state : typeof nested.status === "string" ? nested.status : undefined);
  if (!id || !state) throw new VideoComposerClientError("invalid_response");
  const outputUrl = nested && (typeof nested.outputUrl === "string" ? nested.outputUrl : typeof nested.output_url === "string" ? nested.output_url : undefined);
  return { providerJobId: id, state, ...(outputUrl ? { outputUrl } : {}) };
}

export class VideoComposerClient {
  private readonly baseUrl: URL;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: (input: string | URL, init?: RequestInit) => Promise<Response>;
  constructor(options: VideoComposerClientOptions) {
    const baseUrl = new URL(options.baseUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") throw new TypeError("Video Composer base URL must use HTTP(S)");
    baseUrl.search = ""; baseUrl.hash = ""; if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
    this.baseUrl = baseUrl; this.apiKey = options.apiKey ?? ""; this.timeoutMs = options.timeoutMs ?? 30_000; this.fetchFn = options.fetch ?? fetch;
  }
  async create(payload: Record<string, unknown>): Promise<ComposerJob> { return parseJob(await this.json("v1/jobs", { method: "POST", body: payload })); }
  async status(id: string): Promise<ComposerJob> { return parseJob(await this.json(`v1/jobs/${this.id(id)}`)); }
  async cancel(id: string): Promise<void> { await this.request(`v1/jobs/${this.id(id)}/cancel`, { method: "POST" }); }
  async health(): Promise<void> { await this.request("health"); }
  private id(value: string): string { if (!value || value.includes("/") || value.includes("\\")) throw new VideoComposerClientError("invalid_id"); return encodeURIComponent(value); }
  private async json(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<unknown> { const response = await this.request(path, options); try { return await response.json(); } catch { throw new VideoComposerClientError("invalid_response"); } }
  private async request(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<Response> {
    try {
      const response = await this.fetchFn(new URL(path, this.baseUrl), {
        method: options.method,
        headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}) },
        body: options.body ? JSON.stringify(options.body) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (response.ok) return response;
      if (response.status === 401 || response.status === 403) throw new VideoComposerClientError("unauthorized");
      if (response.status === 429) throw new VideoComposerClientError("rate_limited");
      throw new VideoComposerClientError("unavailable");
    } catch (error) {
      if (error instanceof VideoComposerClientError) throw error;
      const name = error instanceof Error ? error.name : "";
      throw new VideoComposerClientError(name === "AbortError" || name === "TimeoutError" ? "timeout" : "unavailable");
    }
  }
}

export function getVideoComposerClientFromEnv(): VideoComposerClient | null {
  if (!env.CONTENT_OS_VIDEO_COMPOSER_BASE_URL) return null;
  return new VideoComposerClient({ baseUrl: env.CONTENT_OS_VIDEO_COMPOSER_BASE_URL, apiKey: env.CONTENT_OS_VIDEO_COMPOSER_API_KEY, timeoutMs: env.CONTENT_OS_VIDEO_COMPOSER_TIMEOUT_MS });
}
