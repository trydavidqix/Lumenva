#!/usr/bin/env -S npx tsx
// Smoke test for the Fase 3 Asterisk ARI client, run as a real Node process
// (not a vitest suite) via `npx tsx workers/voice-sip-worker/ari-listener.smoke.mjs`.
//
// It starts a minimal fake local Asterisk ARI server (real HTTP + real
// WebSocket, same protocol shape as `lib/voice/sip/asterisk-ari-client.test.ts`)
// and proves the full flow a real listener process would need:
// connect -> receive a StasisStart event -> answer the channel -> close.
//
// This does NOT talk to a real Asterisk instance — there is none reachable
// from this environment. It proves the client's real network behavior as a
// standalone process, not a fake-only unit test. Wiring this into an actual
// long-running listener process bound to `main` (voicecore-test app name,
// tenant resolution via `resolveByConnection`, forwarding events to
// `app/api/internal/voice/event`) is deliberately out of scope — see
// `workers/voice-sip-worker/README.md`.

import http from "node:http";
import { WebSocketServer } from "ws";
import { createAsteriskAriConnection } from "../../lib/voice/sip/asterisk-ari-client.ts";

const USERNAME = "voicecore";
const PASSWORD = "s3cret";

function startFakeAriServer() {
  return new Promise((resolve) => {
    let activeSocket = null;

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const expectedAuth = `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString("base64")}`;
      if (req.headers.authorization !== expectedAuth) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: "authentication failed" }));
        return;
      }
      if (req.method === "POST" && /^\/ari\/channels\/[^/]+\/answer$/.test(url.pathname)) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
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
        callback(url.searchParams.get("api_key") === `${USERNAME}:${PASSWORD}`, 401, "unauthorized");
      },
    });
    wss.on("connection", (socket) => {
      activeSocket = socket;
    });

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        sendEvent: (payload) => activeSocket?.send(JSON.stringify(payload)),
        close: () => new Promise((r) => { wss.close(); server.close(() => r()); }),
      });
    });
  });
}

async function main() {
  const fakeAri = await startFakeAriServer();
  const client = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: USERNAME, password: PASSWORD });

  console.log("[smoke] connecting to fake ARI event stream...");
  const stream = await client.connectEvents("voicecore-test");
  console.log("[smoke] connected.");

  const iterator = stream.events()[Symbol.asyncIterator]();
  const receivedPromise = iterator.next();

  await new Promise((r) => setTimeout(r, 20));
  const stasisStart = { type: "StasisStart", timestamp: new Date().toISOString(), channel: { id: "channel-smoke-1" } };
  fakeAri.sendEvent(stasisStart);

  const received = await receivedPromise;
  if (received.done || JSON.stringify(received.value) !== JSON.stringify(stasisStart)) {
    throw new Error(`[smoke] expected to receive the StasisStart event, got: ${JSON.stringify(received)}`);
  }
  console.log("[smoke] received StasisStart:", received.value);

  await client.answer(stasisStart.channel.id);
  console.log("[smoke] answered channel.");

  await stream.close();
  const afterClose = await iterator.next();
  if (!afterClose.done) {
    throw new Error("[smoke] expected the event stream to end after close()");
  }
  console.log("[smoke] event stream closed cleanly.");

  await fakeAri.close();
  console.log("[smoke] PASS — connect -> StasisStart -> answer -> close proven against a real local ARI-shaped server.");
}

main().catch((error) => {
  console.error("[smoke] FAIL:", error);
  process.exitCode = 1;
});
