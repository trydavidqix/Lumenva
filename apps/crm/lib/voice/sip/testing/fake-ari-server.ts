import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

/**
 * A real local HTTP + WebSocket server speaking the same wire shape as
 * Asterisk's ARI (Basic Auth, `/ari/channels` REST, `/ari/events` WS with
 * `api_key` query auth). Shared by `asterisk-ari-client.test.ts` and
 * `asterisk-listener.test.ts` so both exercise the real protocol against
 * one real server implementation instead of duplicating it.
 */
export interface FakeAriServer {
  baseUrl: string;
  username: string;
  password: string;
  wsSend(payload: unknown): void;
  /** Forcibly terminates the current WS connection without a clean close handshake — simulates an unexpected drop (network blip, server restart), not a graceful client-initiated close(). */
  dropConnection(): void;
  lastRequest: { method: string; url: string; authHeader: string | null } | null;
  respondNextOriginateWith: { status: number; body: unknown } | null;
  close(): Promise<void>;
}

export function startFakeAriServer(options?: { username?: string; password?: string }): Promise<FakeAriServer> {
  const username = options?.username ?? "voicecore";
  const password = options?.password ?? "s3cret";

  return new Promise((resolve) => {
    const state: FakeAriServer = {
      baseUrl: "",
      username,
      password,
      lastRequest: null,
      respondNextOriginateWith: null,
      wsSend: () => {},
      dropConnection: () => {},
      close: async () => {},
    };

    const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      state.lastRequest = {
        method: req.method ?? "",
        url: req.url ?? "",
        authHeader: req.headers.authorization ?? null,
      };

      const expectedAuth = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
      if (req.headers.authorization !== expectedAuth) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: "authentication failed" }));
        return;
      }

      if (req.method === "POST" && url.pathname === "/ari/channels") {
        if (state.respondNextOriginateWith) {
          const { status, body } = state.respondNextOriginateWith;
          res.writeHead(status, { "content-type": "application/json" });
          res.end(JSON.stringify(body));
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ id: "channel-abc" }));
        return;
      }

      if (req.method === "POST" && /^\/ari\/channels\/[^/]+\/answer$/.test(url.pathname)) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
        return;
      }

      if (req.method === "GET" && /^\/ari\/channels\/[^/]+\/variable$/.test(url.pathname)) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ value: "sip-conn-abc" }));
        return;
      }

      if (req.method === "DELETE" && /^\/ari\/channels\/[^/]+$/.test(url.pathname)) {
        if (url.pathname.includes("missing-channel")) {
          res.writeHead(404, { "content-type": "application/json" });
          res.end(JSON.stringify({ message: "Channel not found" }));
          return;
        }
        res.writeHead(204);
        res.end();
        return;
      }

      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "not_found" }));
    });

    const wss = new WebSocketServer({
      server,
      path: "/ari/events",
      verifyClient: (info, callback) => {
        const url = new URL(info.req.url ?? "/", "http://localhost");
        const apiKey = url.searchParams.get("api_key");
        callback(apiKey === `${username}:${password}`, 401, "unauthorized");
      },
    });
    let activeSocket: WebSocket | null = null;
    wss.on("connection", (socket) => {
      activeSocket = socket;
    });

    state.wsSend = (payload: unknown) => {
      activeSocket?.send(JSON.stringify(payload));
    };
    state.dropConnection = () => {
      activeSocket?.terminate();
      activeSocket = null;
    };

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("failed to bind fake ARI server");
      state.baseUrl = `http://127.0.0.1:${address.port}`;
      state.close = () =>
        new Promise<void>((closeResolve) => {
          wss.close();
          server.close(() => closeResolve());
        });
      resolve(state);
    });
  });
}
