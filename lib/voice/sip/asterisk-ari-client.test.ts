// @vitest-environment node
//
// The suite's default jsdom environment replaces the global `Event`/`WebSocket`
// with jsdom's own implementations, which fail Node's internal brand checks
// inside its undici-based WebSocket client (ERR_INVALID_ARG_TYPE). This file
// exercises the real Node WebSocket client against a real local server, so it
// needs Node's actual globals, not jsdom's.
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { WebSocketServer } from "ws";
import { afterEach, describe, expect, it } from "vitest";
import { createAsteriskAriConnection } from "./asterisk-ari-client";

const USERNAME = "voicecore";
const PASSWORD = "s3cret";

interface FakeAri {
  baseUrl: string;
  wsSend(payload: unknown): void;
  lastRequest: { method: string; url: string; authHeader: string | null } | null;
  respondNextOriginateWith: { status: number; body: unknown } | null;
  close(): Promise<void>;
}

function startFakeAriServer(): Promise<FakeAri> {
  return new Promise((resolve) => {
    const state: FakeAri = {
      baseUrl: "",
      lastRequest: null,
      respondNextOriginateWith: null,
      wsSend: () => {},
      close: async () => {},
    };

    const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      state.lastRequest = {
        method: req.method ?? "",
        url: req.url ?? "",
        authHeader: req.headers.authorization ?? null,
      };

      const expectedAuth = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64")}`;
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
        callback(apiKey === `${USERNAME}:${PASSWORD}`, 401, "unauthorized");
      },
    });
    let activeSocket: import("ws").WebSocket | null = null;
    wss.on("connection", (socket) => {
      activeSocket = socket;
    });

    state.wsSend = (payload: unknown) => {
      activeSocket?.send(JSON.stringify(payload));
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

describe("Asterisk ARI concrete client (Fase 3, real wire protocol)", () => {
  let fakeAri: FakeAri | null = null;

  afterEach(async () => {
    await fakeAri?.close();
    fakeAri = null;
  });

  it("originates a call and returns the real channel id", async () => {
    fakeAri = await startFakeAriServer();
    const client = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: USERNAME, password: PASSWORD });

    const result = await client.originate({
      endpoint: "PJSIP/+351911234567@sip-conn-abc",
      callerId: "+351211234567",
      context: "lumenva-voice",
    });

    expect(result).toEqual({ channelId: "channel-abc" });
    expect(fakeAri.lastRequest?.method).toBe("POST");
    expect(fakeAri.lastRequest?.url).toContain("/ari/channels?");
    expect(fakeAri.lastRequest?.url).toContain("endpoint=PJSIP%2F%2B351911234567%40sip-conn-abc");
  });

  it("throws with the real status and body when Asterisk rejects authentication", async () => {
    fakeAri = await startFakeAriServer();
    const client = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: USERNAME, password: "wrong" });

    await expect(
      client.originate({ endpoint: "PJSIP/x@y", callerId: "+351211234567", context: "lumenva-voice" }),
    ).rejects.toThrow(/401/);
  });

  it("throws when Asterisk returns a 5xx originate error", async () => {
    fakeAri = await startFakeAriServer();
    fakeAri.respondNextOriginateWith = { status: 500, body: { message: "internal" } };
    const client = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: USERNAME, password: PASSWORD });

    await expect(
      client.originate({ endpoint: "PJSIP/x@y", callerId: "+351211234567", context: "lumenva-voice" }),
    ).rejects.toThrow(/500/);
  });

  it("answers a channel", async () => {
    fakeAri = await startFakeAriServer();
    const client = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: USERNAME, password: PASSWORD });

    await expect(client.answer("channel-abc")).resolves.toBeUndefined();
    expect(fakeAri.lastRequest?.url).toBe("/ari/channels/channel-abc/answer");
  });

  it("hangs up a channel and surfaces a real 404 for an unknown channel", async () => {
    fakeAri = await startFakeAriServer();
    const client = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: USERNAME, password: PASSWORD });

    await expect(client.hangup("channel-abc", "normal")).resolves.toBeUndefined();
    await expect(client.hangup("missing-channel-id")).rejects.toThrow(/404/);
  });

  it("streams real ARI events in order over a real WebSocket connection", async () => {
    fakeAri = await startFakeAriServer();
    const client = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: USERNAME, password: PASSWORD });

    const stream = await client.connectEvents("voicecore-test");

    const received: unknown[] = [];
    const iterator = stream.events()[Symbol.asyncIterator]();
    const collectTwo = (async () => {
      received.push((await iterator.next()).value);
      received.push((await iterator.next()).value);
    })();

    // Give the server a tick to register the connection before sending.
    await new Promise((r) => setTimeout(r, 20));
    fakeAri.wsSend({ type: "StasisStart", timestamp: "2026-08-27T00:00:00.000Z", channel: { id: "channel-abc" } });
    fakeAri.wsSend({ type: "ChannelHangupRequest", timestamp: "2026-08-27T00:00:05.000Z", channel: { id: "channel-abc" } });

    await collectTwo;
    expect(received).toEqual([
      { type: "StasisStart", timestamp: "2026-08-27T00:00:00.000Z", channel: { id: "channel-abc" } },
      { type: "ChannelHangupRequest", timestamp: "2026-08-27T00:00:05.000Z", channel: { id: "channel-abc" } },
    ]);

    await stream.close();
    const afterClose = await iterator.next();
    expect(afterClose.done).toBe(true);
  });

  it("rejects the event stream connection when the api_key is wrong", async () => {
    fakeAri = await startFakeAriServer();
    const client = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: USERNAME, password: "wrong" });

    await expect(client.connectEvents("voicecore-test")).rejects.toThrow(/failed to connect/);
  });

  it("fails closed on missing config", () => {
    expect(() => createAsteriskAriConnection({ baseUrl: "", username: USERNAME, password: PASSWORD })).toThrow(
      /baseUrl is required/,
    );
    expect(() => createAsteriskAriConnection({ baseUrl: "http://x", username: "", password: PASSWORD })).toThrow(
      /username is required/,
    );
    expect(() => createAsteriskAriConnection({ baseUrl: "http://x", username: USERNAME, password: "" })).toThrow(
      /password is required/,
    );
  });
});
