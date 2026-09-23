export type ExternalOperationContext = {
  organizationId: string;
  requestId: string;
  idempotencyKey?: string;
  dryRun?: boolean;
};

export interface ExternalAdapter<Command, Result> {
  execute(ctx: ExternalOperationContext, command: Command): Promise<Result>;
}

export type NuvemshopCommandType = "get_store" | "create_webhook" | "list_webhooks" | "delete_webhook";

export interface NuvemshopCommand {
  type: NuvemshopCommandType;
  storeId: string;
  token: string;
  event?: string;
  url?: string;
  webhookId?: number;
}

export interface NuvemshopResult {
  ok: boolean;
  data?: any;
  error?: "not_configured" | "invalid_webhook_url" | "unauthorized" | "forbidden" | "not_found" | "rate_limited" | "upstream_error" | "network_error" | "request_failed" | "invalid_json";
  details?: string;
}

export interface NuvemshopAdapterOptions {
  retryDelaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  apiBase?: string;
}

export class NuvemshopAdapter implements ExternalAdapter<NuvemshopCommand, NuvemshopResult> {
  private readonly retryDelaysMs: readonly number[];
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly apiBase: string;

  constructor(options?: NuvemshopAdapterOptions) {
    this.retryDelaysMs = options?.retryDelaysMs ?? [100, 500];
    this.sleep = options?.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.apiBase = options?.apiBase ?? "https://api.nuvemshop.com.br/v1";
  }

  private url(storeId: string, path: string): string {
    const trimmed = path.startsWith("/") ? path : `/${path}`;
    return `${this.apiBase}/${encodeURIComponent(storeId)}${trimmed}`;
  }

  private headers(token: string): HeadersInit {
    return {
      Authentication: `bearer ${token}`,
      "User-Agent": "Lumenva/1.0",
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async request(storeId: string, token: string, method: string, path: string, body?: unknown): Promise<NuvemshopResult> {
    for (let attempt = 0; ; attempt += 1) {
      let res: Response;
      try {
        res = await fetch(this.url(storeId, path), {
          method,
          headers: this.headers(token),
          body: body !== undefined ? JSON.stringify(body) : undefined,
          cache: "no-store",
        });
      } catch (err) {
        if (attempt < this.retryDelaysMs.length) {
          await this.sleep(this.retryDelaysMs[attempt]!);
          continue;
        }
        return { ok: false, error: "network_error", details: String((err as Error).message) };
      }

      const text = await res.text();
      // Handle the cases early so we don't return ok: true on failed requests!
      if (!res.ok) {
        let code: NuvemshopResult["error"] = "request_failed";
        if (res.status === 401) code = "unauthorized";
        else if (res.status === 403) code = "forbidden";
        else if (res.status === 404) code = "not_found";
        else if (res.status === 429) code = "rate_limited";
        else if (res.status >= 500) code = "upstream_error";

        if ((res.status === 429 || res.status >= 500) && attempt < this.retryDelaysMs.length) {
          await this.sleep(this.retryDelaysMs[attempt]!);
          continue;
        }
        return { ok: false, error: code, details: text };
      }

      if (res.status === 204 || text.length === 0) return { ok: true };

      try {
        return { ok: true, data: JSON.parse(text) };
      } catch {
        return { ok: false, error: "invalid_json", details: text };
      }
    }
  }

  async execute(ctx: ExternalOperationContext, command: NuvemshopCommand): Promise<NuvemshopResult> {
    if (!command.storeId || !command.token) {
      return { ok: false, error: "not_configured" };
    }

    switch (command.type) {
      case "get_store":
        return this.request(command.storeId, command.token, "GET", "/store");

      case "list_webhooks":
        return this.request(command.storeId, command.token, "GET", "/webhooks");

      case "create_webhook": {
        if (!command.event || !command.url) {
          return { ok: false, error: "request_failed", details: "Missing event or url" };
        }

        // SSRF protection: only allow https domains (and simple url validation)
        try {
          const u = new URL(command.url);
          if (u.protocol !== "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1") {
            return { ok: false, error: "invalid_webhook_url" };
          }
        } catch {
          return { ok: false, error: "invalid_webhook_url" };
        }

        return this.request(command.storeId, command.token, "POST", "/webhooks", {
          event: command.event,
          url: command.url,
        });
      }

      case "delete_webhook": {
        if (command.webhookId === undefined) {
          return { ok: false, error: "request_failed", details: "Missing webhookId" };
        }
        return this.request(command.storeId, command.token, "DELETE", `/webhooks/${command.webhookId}`);
      }

      default:
        return { ok: false, error: "request_failed", details: "Unknown command type" };
    }
  }
}
