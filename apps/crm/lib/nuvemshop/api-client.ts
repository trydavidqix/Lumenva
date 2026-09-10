/**
 * Nuvemshop REST API client.
 *
 * Handles auth header (`Authentication: bearer <token>` — note lowercase
 * "bearer", per Nuvemshop spec) and User-Agent. Throws `NuvemshopApiError` on
 * non-2xx responses with structured info for the caller.
 */

import { APP_USER_AGENT, NUVEMSHOP_API_BASE, type NuvemshopEvent } from "./config";

export class NuvemshopApiError extends Error {
  status: number;
  code: string;
  body: string;

  constructor(status: number, code: string, body: string, message?: string) {
    super(message ?? `Nuvemshop API ${status} (${code})`);
    this.name = "NuvemshopApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export interface NuvemshopWebhook {
  id: number;
  event: string;
  url: string;
  created_at?: string;
  updated_at?: string;
}

export interface NuvemshopStore {
  id: number;
  name: Record<string, string> | string;
  business_name?: string;
  email?: string;
  url?: string;
  country?: string;
  main_currency?: string;
  main_language?: string;
}

export interface ApiClientOptions {
  storeId: string;
  accessToken: string;
  /** Deterministic delays; empty disables retries (useful for provider-free tests). */
  retryDelaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
}

export class NuvemshopApiClient {
  private readonly storeId: string;
  private readonly accessToken: string;
  private readonly retryDelaysMs: readonly number[];
  private readonly sleep: (ms: number) => Promise<void>;

  constructor({ storeId, accessToken, retryDelaysMs = [100, 500], sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }: ApiClientOptions) {
    if (!storeId) throw new Error("NuvemshopApiClient: storeId required");
    if (!accessToken) throw new Error("NuvemshopApiClient: accessToken required");
    this.storeId = storeId;
    this.accessToken = accessToken;
    this.retryDelaysMs = retryDelaysMs;
    this.sleep = sleep;
  }

  private url(path: string): string {
    const trimmed = path.startsWith("/") ? path : `/${path}`;
    return `${NUVEMSHOP_API_BASE}/${encodeURIComponent(this.storeId)}${trimmed}`;
  }

  private headers(extra?: HeadersInit): HeadersInit {
    return {
      Authentication: `bearer ${this.accessToken}`,
      "User-Agent": APP_USER_AGENT,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(extra ?? {}),
    };
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      let res: Response;
      try {
        res = await fetch(this.url(path), { method, headers: this.headers(), body: body !== undefined ? JSON.stringify(body) : undefined, cache: "no-store" });
      } catch (err) {
        if (attempt < this.retryDelaysMs.length) { await this.sleep(this.retryDelaysMs[attempt]!); continue; }
        throw new NuvemshopApiError(0, "network_error", String((err as Error).message));
      }
      const text = await res.text();
      if (res.status === 204 || text.length === 0) return undefined as T;
      if (!res.ok) {
        const code = res.status === 401 ? "unauthorized" : res.status === 403 ? "forbidden" : res.status === 404 ? "not_found" : res.status === 429 ? "rate_limited" : res.status >= 500 ? "upstream_error" : "request_failed";
        if ((res.status === 429 || res.status >= 500) && attempt < this.retryDelaysMs.length) { await this.sleep(this.retryDelaysMs[attempt]!); continue; }
        throw new NuvemshopApiError(res.status, code, text);
      }
      try { return JSON.parse(text) as T; }
      catch { throw new NuvemshopApiError(res.status, "invalid_json", text); }
    }
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  delete(path: string): Promise<void> {
    return this.request<void>("DELETE", path);
  }

  // ---- Convenience wrappers ---------------------------------------------------

  getStore(): Promise<NuvemshopStore> {
    return this.get<NuvemshopStore>("/store");
  }

  listWebhooks(): Promise<NuvemshopWebhook[]> {
    return this.get<NuvemshopWebhook[]>("/webhooks");
  }

  createWebhook(event: NuvemshopEvent, url: string): Promise<NuvemshopWebhook> {
    return this.post<NuvemshopWebhook>("/webhooks", { event, url });
  }

  deleteWebhook(id: number): Promise<void> {
    return this.delete(`/webhooks/${id}`);
  }
}
