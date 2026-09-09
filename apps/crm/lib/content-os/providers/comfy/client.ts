import { env } from "@/lib/env";

export type ComfyClientErrorCode = "invalid_response" | "invalid_id" | "timeout" | "unauthorized" | "rate_limited" | "unavailable";

export class ComfyClientError extends Error {
  readonly name = "ComfyClientError";
  constructor(readonly code: ComfyClientErrorCode) { super("ComfyUI request failed"); }
}

export type ComfyClientOptions = { baseUrl: string; apiKey?: string; timeoutMs?: number; fetch?: (input: string | URL, init?: RequestInit) => Promise<Response> };
export type ComfyPromptResult = { providerJobId: string; state?: string };

const DEFAULT_TIMEOUT_MS = 15_000;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function parsePrompt(value: unknown): ComfyPromptResult {
  if (!isRecord(value) || typeof value.prompt_id !== "string" || !value.prompt_id) throw new ComfyClientError("invalid_response");
  return { providerJobId: value.prompt_id, state: typeof value.status === "string" ? value.status : undefined };
}

function parseHistory(value: unknown, id: string): ComfyPromptResult {
  if (!isRecord(value)) throw new ComfyClientError("invalid_response");
  const entry = isRecord(value[id]) ? value[id] : value;
  if (!isRecord(entry)) throw new ComfyClientError("invalid_response");
  const status = isRecord(entry.status) ? entry.status : entry;
  const valueState = status && typeof status.status_str === "string" ? status.status_str : typeof entry.state === "string" ? entry.state : undefined;
  if (!valueState) throw new ComfyClientError("invalid_response");
  return { providerJobId: id, state: valueState };
}

export class ComfyClient {
  private readonly baseUrl: URL;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: (input: string | URL, init?: RequestInit) => Promise<Response>;

  constructor(options: ComfyClientOptions) {
    const baseUrl = new URL(options.baseUrl);
    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") throw new TypeError("ComfyUI base URL must use HTTP(S)");
    baseUrl.search = ""; baseUrl.hash = "";
    if (!baseUrl.pathname.endsWith("/")) baseUrl.pathname += "/";
    this.baseUrl = baseUrl; this.apiKey = options.apiKey ?? ""; this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS; this.fetchFn = options.fetch ?? fetch;
  }

  async prompt(payload: Record<string, unknown>): Promise<ComfyPromptResult> {
    return parsePrompt(await this.json("prompt", { method: "POST", body: payload }));
  }

  async history(providerJobId: string): Promise<ComfyPromptResult> {
    const id = this.id(providerJobId);
    return parseHistory(await this.json(`history/${id}`), providerJobId);
  }

  async interrupt(providerJobId: string): Promise<void> {
    this.id(providerJobId);
    await this.request("interrupt", { method: "POST", body: { prompt_id: providerJobId } });
  }

  async health(): Promise<void> { await this.request("system_stats"); }

  private id(value: string): string {
    if (!value || value.includes("/") || value.includes("\\")) throw new ComfyClientError("invalid_id");
    return encodeURIComponent(value);
  }

  private async json(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<unknown> {
    const response = await this.request(path, options);
    try { return await response.json(); } catch { throw new ComfyClientError("invalid_response"); }
  }

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
      if (response.status === 401 || response.status === 403) throw new ComfyClientError("unauthorized");
      if (response.status === 429) throw new ComfyClientError("rate_limited");
      throw new ComfyClientError("unavailable");
    } catch (error) {
      if (error instanceof ComfyClientError) throw error;
      const name = error instanceof Error ? error.name : "";
      throw new ComfyClientError(name === "AbortError" || name === "TimeoutError" ? "timeout" : "unavailable");
    }
  }
}

export function getComfyClientFromEnv(): ComfyClient | null {
  if (!env.CONTENT_OS_COMFY_BASE_URL) return null;
  return new ComfyClient({ baseUrl: env.CONTENT_OS_COMFY_BASE_URL, apiKey: env.CONTENT_OS_COMFY_API_KEY, timeoutMs: env.CONTENT_OS_COMFY_TIMEOUT_MS });
}
