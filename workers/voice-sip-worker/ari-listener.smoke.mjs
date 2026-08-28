#!/usr/bin/env -S npx tsx
// Smoke test for the Fase 3 Asterisk ARI listener, run as a real Node process
// (not a vitest suite) via `npx tsx workers/voice-sip-worker/ari-listener.smoke.mjs`.
//
// It starts a minimal fake local Asterisk ARI server (real HTTP + real
// WebSocket, same protocol shape as `lib/voice/sip/testing/fake-ari-server.ts`)
// and proves the full flow a real listener process would need:
// connect -> normalize a StasisStart -> survive an unsupported event type
// without dying -> normalize a ChannelHangupRequest -> survive an
// unexpected WebSocket drop by reconnecting on its own -> normalize an
// event on the reconnected socket -> close.
//
// This does NOT talk to a real Asterisk instance — there is none reachable
// from this environment. It proves the client/listener's real network
// behavior as a standalone process, not a fake-only unit test. Forwarding
// the normalized events to the CRM (app/api/internal/voice/event) is
// deliberately out of scope — see `workers/voice-sip-worker/README.md`.

import http from "node:http";
import { WebSocketServer } from "ws";
import { createAsteriskAriConnection } from "../../lib/voice/sip/asterisk-ari-client.ts";
import { createAsteriskSipGateway } from "../../lib/voice/sip/asterisk-adapter.ts";
import { createAsteriskAriListener } from "../../lib/voice/sip/asterisk-listener.ts";

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
        dropConnection: () => { activeSocket?.terminate(); activeSocket = null; },
        close: () => new Promise((r) => { wss.close(); server.close(() => r()); }),
      });
    });
  });
}

function stasisEvent(type, channelId) {
  return {
    type,
    timestamp: new Date().toISOString(),
    channel: {
      id: channelId,
      caller: { number: "+351911234567" },
      connected: { number: "+351211234567" },
      channelvars: { SIP_CONNECTION_ID: "sip-conn-abc" },
    },
  };
}

async function main() {
  const fakeAri = await startFakeAriServer();
  const connection = createAsteriskAriConnection({ baseUrl: fakeAri.baseUrl, username: USERNAME, password: PASSWORD });
  const gateway = createAsteriskSipGateway({
    directory: { resolveOrganizationByConnection: async () => "org-smoke-1" },
    ariClient: { originate: async () => ({ channelId: "unused" }) },
    outboundContext: "lumenva-voice",
  });

  console.log("[smoke] connecting listener...");
  const listener = await createAsteriskAriListener({
    connection,
    gateway,
    appName: "voicecore-test",
    reconnectDelayMs: 50,
  });
  const iterator = listener.events()[Symbol.asyncIterator]();
  console.log("[smoke] connected.");

  const first = iterator.next();
  const second = iterator.next();
  const third = iterator.next();

  await new Promise((r) => setTimeout(r, 20));
  fakeAri.sendEvent(stasisEvent("StasisStart", "channel-smoke-1"));
  fakeAri.sendEvent({ type: "ChannelVarset", timestamp: new Date().toISOString() }); // unsupported, must not crash the loop
  fakeAri.sendEvent(stasisEvent("ChannelHangupRequest", "channel-smoke-1"));

  const firstResult = (await first).value;
  if (firstResult.status !== "normalized" || firstResult.event.eventType !== "StasisStart") {
    throw new Error(`[smoke] expected StasisStart to normalize, got: ${JSON.stringify(firstResult)}`);
  }
  console.log("[smoke] normalized StasisStart:", firstResult.event);

  const secondResult = (await second).value;
  if (secondResult.status !== "rejected") {
    throw new Error(`[smoke] expected the unsupported event to be rejected, got: ${JSON.stringify(secondResult)}`);
  }
  console.log("[smoke] correctly rejected unsupported event without crashing:", secondResult.error.message);

  const thirdResult = (await third).value;
  if (thirdResult.status !== "normalized" || thirdResult.event.eventType !== "ChannelHangupRequest") {
    throw new Error(`[smoke] expected ChannelHangupRequest to normalize, got: ${JSON.stringify(thirdResult)}`);
  }
  console.log("[smoke] normalized ChannelHangupRequest:", thirdResult.event);

  console.log("[smoke] dropping the connection to test automatic reconnection...");
  const afterReconnect = iterator.next();
  fakeAri.dropConnection();
  await new Promise((r) => setTimeout(r, 300));
  fakeAri.sendEvent(stasisEvent("StasisStart", "channel-smoke-reconnected"));

  const reconnectResult = (await afterReconnect).value;
  if (reconnectResult.status !== "normalized" || reconnectResult.event.providerEventId !== "channel-smoke-reconnected") {
    throw new Error(`[smoke] expected reconnection to recover and normalize the next event, got: ${JSON.stringify(reconnectResult)}`);
  }
  console.log("[smoke] reconnected automatically and normalized the next event:", reconnectResult.event);

  await listener.close();
  const afterClose = await iterator.next();
  if (!afterClose.done) {
    throw new Error("[smoke] expected the listener to end after close()");
  }
  console.log("[smoke] listener closed cleanly.");

  await fakeAri.close();
  console.log(
    "[smoke] PASS — connect -> normalize -> survive unsupported event -> normalize -> reconnect after a drop -> normalize -> close, proven against a real local ARI-shaped server.",
  );
}

main().catch((error) => {
  console.error("[smoke] FAIL:", error);
  process.exitCode = 1;
});
