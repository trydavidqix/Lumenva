import type { AriClient, AriOriginateResult } from "./asterisk-adapter";
import type { RtpMediaAriClient } from "./rtp-media-bridge";

/**
 * Concrete Asterisk ARI transport (Fase 3, fatia real). Talks the actual
 * ARI REST + WebSocket wire protocol documented by Asterisk — nothing here
 * is invented. This file is the only place that knows the ARI HTTP paths,
 * query params, and event-stream URL; everything else in the Voice Core
 * only ever sees `AriClient`/`AriConnection`.
 *
 * `asterisk-adapter.ts` already defines the narrow, already-tested
 * `AriClient` (originate-only) — this file implements it and extends it
 * with `AriConnection` for the capabilities the adapter doesn't need
 * (answer/hangup/event stream), so `asterisk-adapter.ts` and its existing
 * tests stay untouched.
 */

export interface AriEventStream {
  /** Raw parsed ARI event JSON. Narrowing into e.g. StasisStart happens in asterisk-adapter.ts, not here. */
  events(): AsyncIterable<unknown>;
  close(): Promise<void>;
}

export interface AriConnection extends AriClient, RtpMediaAriClient {
  connectEvents(appName: string): Promise<AriEventStream>;
  getChannelVariable(channelId: string, variable: string): Promise<string | null>;
  answer(channelId: string): Promise<void>;
  hangup(channelId: string, reason?: string): Promise<void>;
}

export interface AsteriskAriConfig {
  /** e.g. http://127.0.0.1:8088 */
  baseUrl: string;
  username: string;
  password: string;
  /** Request timeout in ms for REST calls. Defaults to 10_000. */
  timeoutMs?: number;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests; defaults to the global WebSocket. */
  webSocketImpl?: typeof WebSocket;
}

function basicAuthHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function toWsUrl(baseUrl: string): URL {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url;
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

export function createAsteriskAriConnection(config: AsteriskAriConfig): AriConnection {
  if (!config.baseUrl.trim()) throw new Error("[voice] Asterisk ARI baseUrl is required");
  if (!config.username.trim()) throw new Error("[voice] Asterisk ARI username is required");
  if (!config.password) throw new Error("[voice] Asterisk ARI password is required");

  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const timeoutMs = config.timeoutMs ?? 10_000;
  const fetchImpl = config.fetchImpl ?? fetch;
  const webSocketImpl = config.webSocketImpl ?? WebSocket;
  const authHeader = basicAuthHeader(config.username, config.password);

  async function request(method: string, path: string): Promise<Response> {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: authHeader, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      const body = await readErrorBody(response);
      throw new Error(`[voice] Asterisk ARI ${method} ${path} failed: ${response.status} ${body}`);
    }
    return response;
  }

  return {
    async originate(input): Promise<AriOriginateResult> {
      const params = new URLSearchParams({
        endpoint: input.endpoint,
        callerId: input.callerId,
        context: input.context,
        extension: "s",
        priority: "1",
      });
      const response = await request("POST", `/ari/channels?${params.toString()}`);
      const payload = (await response.json()) as { id?: unknown };
      if (typeof payload.id !== "string" || !payload.id.trim()) {
        throw new Error("[voice] Asterisk ARI originate response is missing channel id");
      }
      return { channelId: payload.id };
    },

    async answer(channelId): Promise<void> {
      if (!channelId.trim()) throw new Error("[voice] Asterisk ARI answer requires a channel id");
      await request("POST", `/ari/channels/${encodeURIComponent(channelId)}/answer`);
    },

    async getChannelVariable(channelId, variable): Promise<string | null> {
      if (!channelId.trim()) throw new Error("[voice] Asterisk ARI getChannelVariable requires a channel id");
      if (!variable.trim()) throw new Error("[voice] Asterisk ARI getChannelVariable requires a variable name");
      const response = await request(
        "GET",
        `/ari/channels/${encodeURIComponent(channelId)}/variable?variable=${encodeURIComponent(variable)}`,
      );
      const payload = (await response.json()) as { value?: unknown };
      return typeof payload.value === "string" && payload.value.trim() ? payload.value.trim() : null;
    },

    async hangup(channelId, reason): Promise<void> {
      if (!channelId.trim()) throw new Error("[voice] Asterisk ARI hangup requires a channel id");
      const query = reason ? `?reason=${encodeURIComponent(reason)}` : "";
      await request("DELETE", `/ari/channels/${encodeURIComponent(channelId)}${query}`);
    },

    async createBridge(): Promise<{ bridgeId: string }> {
      const response = await request("POST", "/ari/bridges?type=mixing");
      const payload = (await response.json()) as { id?: unknown };
      if (typeof payload.id !== "string" || !payload.id.trim()) {
        throw new Error("[voice] Asterisk ARI bridge response is missing bridge id");
      }
      return { bridgeId: payload.id };
    },

    async createExternalMedia(input): Promise<{ channelId: string }> {
      const params = new URLSearchParams({
        app: input.appName,
        external_host: input.externalHost,
        format: input.format,
        encapsulation: "rtp",
        transport: "udp",
        connection_type: "client",
        direction: input.direction,
      });
      const response = await request("POST", `/ari/channels/externalMedia?${params.toString()}`);
      const payload = (await response.json()) as { id?: unknown };
      if (typeof payload.id !== "string" || !payload.id.trim()) {
        throw new Error("[voice] Asterisk ARI external media response is missing channel id");
      }
      return { channelId: payload.id };
    },

    async addChannels(bridgeId, channelIds): Promise<void> {
      if (!bridgeId.trim()) throw new Error("[voice] Asterisk ARI addChannels requires a bridge id");
      if (!channelIds.length || channelIds.some((id) => !id.trim())) {
        throw new Error("[voice] Asterisk ARI addChannels requires channel ids");
      }
      const params = new URLSearchParams({ channel: channelIds.join(",") });
      await request("POST", `/ari/bridges/${encodeURIComponent(bridgeId)}/addChannel?${params.toString()}`);
    },

    async destroyBridge(bridgeId): Promise<void> {
      if (!bridgeId.trim()) throw new Error("[voice] Asterisk ARI destroyBridge requires a bridge id");
      await request("DELETE", `/ari/bridges/${encodeURIComponent(bridgeId)}`);
    },

    async connectEvents(appName): Promise<AriEventStream> {
      if (!appName.trim()) throw new Error("[voice] Asterisk ARI connectEvents requires an app name");

      const wsUrl = toWsUrl(baseUrl);
      wsUrl.pathname = "/ari/events";
      wsUrl.searchParams.set("app", appName);
      wsUrl.searchParams.set("api_key", `${config.username}:${config.password}`);

      const socket = new webSocketImpl(wsUrl.toString());

      await new Promise<void>((resolve, reject) => {
        const onOpen = () => {
          socket.removeEventListener("error", onError);
          resolve();
        };
        const onError = () => {
          socket.removeEventListener("open", onOpen);
          reject(new Error("[voice] Asterisk ARI event stream failed to connect"));
        };
        socket.addEventListener("open", onOpen, { once: true });
        socket.addEventListener("error", onError, { once: true });
      });

      let closed = false;
      const queue: unknown[] = [];
      const waiters: Array<(value: IteratorResult<unknown>) => void> = [];

      socket.addEventListener("message", (event: MessageEvent) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(event.data));
        } catch {
          return; // never crash the stream on a malformed frame
        }
        const waiter = waiters.shift();
        if (waiter) {
          waiter({ value: parsed, done: false });
        } else {
          queue.push(parsed);
        }
      });

      socket.addEventListener("close", () => {
        closed = true;
        while (waiters.length > 0) {
          waiters.shift()!({ value: undefined, done: true });
        }
      });

      return {
        events(): AsyncIterable<unknown> {
          return {
            [Symbol.asyncIterator]() {
              return {
                next(): Promise<IteratorResult<unknown>> {
                  if (queue.length > 0) {
                    return Promise.resolve({ value: queue.shift(), done: false });
                  }
                  if (closed) {
                    return Promise.resolve({ value: undefined, done: true });
                  }
                  return new Promise((resolve) => waiters.push(resolve));
                },
              };
            },
          };
        },
        async close(): Promise<void> {
          if (closed) return;
          await new Promise<void>((resolve) => {
            socket.addEventListener("close", () => resolve(), { once: true });
            socket.close();
          });
        },
      };
    },
  };
}
