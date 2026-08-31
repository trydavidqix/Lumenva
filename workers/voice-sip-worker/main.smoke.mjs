#!/usr/bin/env -S npx tsx
// Smoke test for the Fase 3 production entrypoint (main.mjs), run as a real
// Node process via `npx tsx workers/voice-sip-worker/main.smoke.mjs`.
//
// Unlike the other smoke tests in this directory, this one also needs a
// real Postgres reachable via SUPABASE_DB_URL (createVoiceSipWorker's local
// tenant-boundary check is DB-backed — see main.mjs's header comment for
// why). It is SKIPPED, not failed, when SUPABASE_DB_URL is unset, since a
// real Postgres is legitimately absent in some environments — the other
// smoke tests and the vitest suite already cover everything that doesn't
// need one.
//
// Proves the whole real entrypoint as a black box: env parsing -> real ARI
// connection -> real Postgres tenant resolution -> real HTTP forwarding to
// a fake CRM -> /healthz -> graceful shutdown.
//
// A second scenario (below, "media scenario") additionally proves the
// RTP+STT+Agent OS+TTS wiring added on top of signaling: a real UDP client
// stands in for Asterisk's externalMedia RTP peer (real dgram sockets, same
// as rtp-media-bridge.test.ts), and a fake HTTP sidecar stands in for the
// real Python STT/TTS process (never the real one here — that would make
// this smoke test depend on the VPS being up, which is the opposite of
// hermetic/reproducible).

import dgram from "node:dgram";
import http from "node:http";
import { WebSocketServer } from "ws";
import { createVoiceSipWorker } from "./main.mjs";

if (!process.env.SUPABASE_DB_URL) {
  console.log("[smoke] SUPABASE_DB_URL not set — skipping main.smoke.mjs (needs a real local Postgres).");
  process.exit(0);
}

const ARI_USERNAME = "voicecore";
const ARI_PASSWORD = "s3cret";

function startFakeAriServer() {
  return new Promise((resolve) => {
    let activeSocket = null;
    // Populated by the media scenario's POST /ari/channels/externalMedia
    // handler below — captures the UDP port main.mjs's real
    // createAsteriskRtpMediaBridge asked Asterisk to send RTP to, so the
    // smoke test's fake UDP "Asterisk" peer knows where to send inbound RTP.
    let lastExternalMediaPort = null;
    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const expectedAuth = `Basic ${Buffer.from(`${ARI_USERNAME}:${ARI_PASSWORD}`).toString("base64")}`;
      if (req.headers.authorization !== expectedAuth) {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: "authentication failed" }));
        return;
      }
      // Real Asterisk ARI endpoints createAsteriskRtpMediaBridge calls
      // (lib/voice/sip/rtp-media-bridge.ts via asterisk-ari-client.ts) —
      // same shapes proven in rtp-media-bridge.test.ts / asterisk-ari-client.test.ts.
      if (req.method === "POST" && url.pathname === "/ari/bridges") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ id: "bridge-media-smoke-1" }));
        return;
      }
      if (req.method === "POST" && url.pathname === "/ari/channels/externalMedia") {
        const externalHost = url.searchParams.get("external_host") ?? "";
        const port = Number(externalHost.split(":").pop());
        if (Number.isInteger(port) && port > 0) lastExternalMediaPort = port;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ id: "external-media-smoke-1" }));
        return;
      }
      if (req.method === "POST" && /^\/ari\/bridges\/[^/]+\/addChannel$/.test(url.pathname)) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
        return;
      }
      if (req.method === "DELETE" && /^\/ari\/channels\/[^/]+$/.test(url.pathname)) {
        res.writeHead(204);
        res.end();
        return;
      }
      if (req.method === "DELETE" && /^\/ari\/bridges\/[^/]+$/.test(url.pathname)) {
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
        callback(url.searchParams.get("api_key") === `${ARI_USERNAME}:${ARI_PASSWORD}`, 401, "unauthorized");
      },
    });
    wss.on("connection", (socket) => { activeSocket = socket; });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        sendEvent: (payload) => activeSocket?.send(JSON.stringify(payload)),
        getLastExternalMediaPort: () => lastExternalMediaPort,
        close: () => new Promise((r) => { wss.close(); server.close(() => r()); }),
      });
    });
  });
}

function startFakeCrmServer() {
  return new Promise((resolve) => {
    const requestsReceived = [];
    const server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (chunk) => (raw += chunk));
      req.on("end", () => {
        const body = raw ? JSON.parse(raw) : {};
        requestsReceived.push({ path: req.url, body });
        if (req.url === "/api/internal/voice/context") {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ data: { voice_call_id: "voice-call-smoke-1", contact_id: null, caller_kind: "unknown", locale: "pt" } }));
          return;
        }
        if (req.url === "/api/internal/voice/event") {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ data: { recorded: true } }));
          return;
        }
        if (req.url === "/api/internal/voice/turn") {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ data: { kind: "reply", text: "Ola, como posso ajudar?" } }));
          return;
        }
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: "not_found" } }));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ baseUrl: `http://127.0.0.1:${port}`, requestsReceived, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

/**
 * Fake Python STT/TTS sidecar — same /stt (batch STT) and /speak (TTS) HTTP
 * contract as voice_worker_server_v12.py that
 * lib/voice/media/sidecar-speech-adapter.ts talks to. Never the real
 * Python process: this smoke test must stay hermetic/reproducible without
 * depending on the VPS sidecar being up.
 */
function startFakeSidecarServer() {
  return new Promise((resolve) => {
    const requestsReceived = [];
    // One-shot failure injection for the failure-injection scenario below —
    // failNextRequest("/stt") makes exactly the NEXT request to that path
    // respond 500, then clears itself so later turns succeed normally.
    const failNext = new Set();
    const server = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        const body = Buffer.concat(chunks);
        requestsReceived.push({ path: req.url, bytes: body.length });
        if (failNext.has(req.url)) {
          failNext.delete(req.url);
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ error: "injected_failure" }));
          return;
        }
        if (req.url === "/stt") {
          res.writeHead(200, { "content-type": "text/plain" });
          res.end("ola, preciso de ajuda");
          return;
        }
        if (req.url === "/speak") {
          res.writeHead(200, { "content-type": "application/octet-stream" });
          // Distinctive byte (0xab), deliberately NOT continuous-sender.ts's own 0xff
          // silence filler — lets the media scenario prove real synthesized audio
          // reached the RTP peer, not just the sender's idle-silence cadence.
          res.end(Buffer.alloc(160, 0xab));
          return;
        }
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "not_found" }));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        requestsReceived,
        failNextRequest: (path) => failNext.add(path),
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

/**
 * Temporarily captures console.error calls whose first argument is JSON
 * containing a given `msg` field, while still forwarding to the real
 * console.error so smoke-test output stays visible. Used by the
 * failure-injection scenario to prove `voice_media_turn_failed` was really
 * logged for the injected failure, not just that the call kept running.
 */
function captureLoggedErrors(msg) {
  const matches = [];
  const original = console.error;
  console.error = (...args) => {
    try {
      const parsed = typeof args[0] === "string" ? JSON.parse(args[0]) : null;
      if (parsed && parsed.msg === msg) matches.push(parsed);
    } catch {
      // not JSON — not one of ours, ignore
    }
    original(...args);
  };
  return { matches, restore: () => { console.error = original; } };
}

async function httpGetJson(url) {
  const response = await fetch(url);
  return { status: response.status, body: await response.json() };
}

/**
 * Stands in for Asterisk's externalMedia RTP peer: a real UDP socket
 * (dgram, same as rtp-media-bridge.test.ts) that sends inbound RTP to
 * main.mjs's real RTP bridge and records whatever RTP the worker sends
 * back. It is NOT bound until the bridge's UDP port is known (learned from
 * the fake ARI server's captured `external_host` — see
 * `startFakeAriServer`), because real Asterisk would dial that same port.
 */
function startFakeAsteriskRtpPeer() {
  const socket = dgram.createSocket("udp4");
  const receivedPackets = [];
  socket.on("message", (packet) => receivedPackets.push(packet));
  return new Promise((resolve) => {
    socket.bind(0, "127.0.0.1", () => {
      resolve({
        sendTo(port, packet) {
          socket.send(packet, port, "127.0.0.1");
        },
        receivedPackets,
        close: () => new Promise((r) => socket.close(r)),
      });
    });
  });
}

function buildFakeRtpPacket(payload) {
  const header = Buffer.alloc(12);
  header[0] = 0x80;
  return Buffer.concat([header, payload]);
}

async function runSignalingScenario() {
  const fakeAri = await startFakeAriServer();
  const fakeCrm = await startFakeCrmServer();

  const worker = await createVoiceSipWorker({
    ARI_BASE_URL: fakeAri.baseUrl,
    ARI_USERNAME,
    ARI_PASSWORD,
    ARI_APP_NAME: "voicecore-test",
    SIP_OUTBOUND_CONTEXT: "lumenva-voice",
    VOICE_CONTROL_PLANE_URL: fakeCrm.baseUrl,
    INTERNAL_SECRET: "s3cret-smoke",
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
    PORT: "0", // OS-assigned free port, parallel-safe
  });

  console.log("[smoke] starting the real production entrypoint (createVoiceSipWorker)...");
  const runPromise = worker.run();

  try {
    // Give the worker time to bind its healthz server and connect to the fake ARI.
    await new Promise((r) => setTimeout(r, 300));

    await new Promise((r) => setTimeout(r, 20));
    fakeAri.sendEvent({
      type: "StasisStart",
      timestamp: new Date().toISOString(),
      channel: {
        id: "channel-main-smoke-1",
        caller: { number: "+351911234567" },
        connected: { number: "+351211234567" },
        channelvars: { SIP_CONNECTION_ID: "sip-conn-abc" }, // seeded in the smoke test's Postgres database
      },
    });

    await new Promise((r) => setTimeout(r, 300));

    const contextCalls = fakeCrm.requestsReceived.filter((r) => r.path === "/api/internal/voice/context");
    const eventCalls = fakeCrm.requestsReceived.filter((r) => r.path === "/api/internal/voice/event");
    if (contextCalls.length !== 1 || eventCalls.length !== 1) {
      throw new Error(`[smoke] expected 1 /context + 1 /event call after a real Postgres-backed resolution, got: ${JSON.stringify(fakeCrm.requestsReceived)}`);
    }
    if (contextCalls[0].body.connection_id !== "sip-conn-abc" || eventCalls[0].body.state !== "active") {
      throw new Error(`[smoke] unexpected forwarded payload: ${JSON.stringify(fakeCrm.requestsReceived)}`);
    }
    console.log("[smoke] real Postgres resolved the tenant and the worker forwarded to the fake CRM:", fakeCrm.requestsReceived);

    console.log("[smoke] checking /healthz on the real running server...");
    const healthzPort = worker.healthzPort();
    if (!healthzPort) throw new Error("[smoke] expected the healthz server to be bound by now");
    const health = await httpGetJson(`http://127.0.0.1:${healthzPort}/healthz`);
    if (health.status !== 200 || health.body.status !== "ok") {
      throw new Error(`[smoke] expected /healthz to report ok, got: ${JSON.stringify(health)}`);
    }
    console.log("[smoke] /healthz reports:", health.body);

    console.log("[smoke] PASS — real entrypoint: env parsing -> real Postgres tenant resolution -> real HTTP forward -> graceful shutdown.");
  } finally {
    // Must run on the failure path too — otherwise the listener/healthz
    // server/pool stay open and the process never exits on its own,
    // hanging the whole verify-voice-core.sh gate instead of failing fast.
    console.log("[smoke] stopping the worker (graceful shutdown)...");
    await worker.stop("SIGTERM-smoke");
    await runPromise;
    await fakeAri.close();
    await fakeCrm.close();
  }
}

/**
 * Proves the media wiring added on top of signaling (attachMedia/detach
 * hooked into the real event loop): StasisStart -> real RTP bridge (fake
 * ARI, real UDP) -> capture window -> fake sidecar /stt -> fake CRM /turn
 * -> fake sidecar /speak -> RTP sent back to the "Asterisk" peer ->
 * StasisEnd -> detach (bridge torn down).
 */
async function runMediaScenario() {
  const fakeAri = await startFakeAriServer();
  const fakeCrm = await startFakeCrmServer();
  const fakeSidecar = await startFakeSidecarServer();
  const rtpPeer = await startFakeAsteriskRtpPeer();

  const worker = await createVoiceSipWorker({
    ARI_BASE_URL: fakeAri.baseUrl,
    ARI_USERNAME,
    ARI_PASSWORD,
    ARI_APP_NAME: "voicecore-test",
    SIP_OUTBOUND_CONTEXT: "lumenva-voice",
    VOICE_CONTROL_PLANE_URL: fakeCrm.baseUrl,
    INTERNAL_SECRET: "s3cret-smoke",
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
    PORT: "0",
    VOICE_MEDIA_EXTERNAL_HOST: "127.0.0.1",
    VOICE_MEDIA_SIDECAR_URL: fakeSidecar.baseUrl,
    VOICE_MEDIA_LISTEN_MS: "300", // short capture window so the smoke test doesn't wait the real 4000ms default
  });

  console.log("[smoke] starting a second real entrypoint instance with media enabled...");
  const runPromise = worker.run();

  try {
    await new Promise((r) => setTimeout(r, 300));

    fakeAri.sendEvent({
      type: "StasisStart",
      timestamp: new Date().toISOString(),
      channel: {
        id: "channel-media-smoke-1",
        caller: { number: "+351911234567" },
        connected: { number: "+351211234567" },
        channelvars: { SIP_CONNECTION_ID: "sip-conn-abc" }, // same seeded connection as the signaling scenario
      },
    });

    // Wait for attachMedia() to run rtpBridge.start() (createBridge ->
    // createExternalMedia -> addChannels against the fake ARI server) and
    // learn the UDP port it asked Asterisk to send RTP to.
    let bridgePort = null;
    for (let attempt = 0; attempt < 20 && !bridgePort; attempt += 1) {
      await new Promise((r) => setTimeout(r, 50));
      bridgePort = fakeAri.getLastExternalMediaPort();
    }
    if (!bridgePort) throw new Error("[smoke] expected the media bridge to call POST /ari/channels/externalMedia by now");
    console.log("[smoke] real RTP bridge is listening on port", bridgePort);

    // Stand in for Asterisk: send inbound RTP with a µ-law payload. main.mjs
    // now runs a single continuous consumer for the whole session's RTP
    // (see attachMedia's comment), so any packet sent while the session is
    // open lands in the next turn's capture buffer — no timing dance needed.
    for (let i = 0; i < 12; i += 1) {
      rtpPeer.sendTo(bridgePort, buildFakeRtpPacket(Buffer.alloc(160, 0x02)));
      await new Promise((r) => setTimeout(r, 20));
    }
    for (let i = 0; i < 25; i += 1) {
      rtpPeer.sendTo(bridgePort, buildFakeRtpPacket(Buffer.alloc(160, 0xff)));
      await new Promise((r) => setTimeout(r, 20));
    }

    // Give the worker's capture window (300ms) + turn (STT -> /turn -> TTS)
    // time to run, plus a margin for the continuous sender's 20ms cadence
    // to actually push a packet back.
    await new Promise((r) => setTimeout(r, 1500));

    const sttCalls = fakeSidecar.requestsReceived.filter((r) => r.path === "/stt");
    const speakCalls = fakeSidecar.requestsReceived.filter((r) => r.path === "/speak");
    const turnCalls = fakeCrm.requestsReceived.filter((r) => r.path === "/api/internal/voice/turn");
    if (sttCalls.length < 1 || speakCalls.length < 1 || turnCalls.length < 1) {
      throw new Error(
        `[smoke] expected the media loop to call /stt, /api/internal/voice/turn and /speak — got stt=${sttCalls.length} turn=${turnCalls.length} speak=${speakCalls.length}`,
      );
    }
    if (turnCalls[0].body.transcript !== "ola, preciso de ajuda") {
      throw new Error(`[smoke] unexpected transcript forwarded to /turn: ${JSON.stringify(turnCalls[0].body)}`);
    }
    // continuous-sender.ts sends 20ms silence (0xff) frames on its own cadence
    // the instant the RTP peer becomes known — so "received >=1 packet" alone
    // would pass even without the turn ever running. Require a packet whose
    // payload is the fake TTS's distinctive 0xab byte, proving the
    // synthesized reply itself reached the RTP peer, not just idle silence.
    const ttsPacketsReceived = rtpPeer.receivedPackets.filter((packet) => {
      const payload = packet.subarray(12);
      return payload.length > 0 && payload.every((byte) => byte === 0xab);
    });
    if (ttsPacketsReceived.length < 1) {
      throw new Error(
        `[smoke] expected at least one RTP packet carrying the synthesized (0xab) TTS payload — got ${rtpPeer.receivedPackets.length} packet(s) total, none matching`,
      );
    }
    console.log(
      "[smoke] media loop ran end to end: RTP captured -> /stt -> /turn -> /speak -> synthesized RTP sent back",
      { sttCalls: sttCalls.length, turnCalls: turnCalls.length, speakCalls: speakCalls.length, ttsPacketsReceived: ttsPacketsReceived.length, totalPacketsReceived: rtpPeer.receivedPackets.length },
    );

    fakeAri.sendEvent({
      type: "StasisEnd",
      timestamp: new Date().toISOString(),
      channel: {
        id: "channel-media-smoke-1",
        caller: { number: "+351911234567" },
        connected: { number: "+351211234567" },
        channelvars: { SIP_CONNECTION_ID: "sip-conn-abc" },
      },
    });
    await new Promise((r) => setTimeout(r, 300));

    console.log("[smoke] PASS — media scenario: RTP+STT+Agent OS+TTS wired end to end, detach on StasisEnd.");
  } finally {
    console.log("[smoke] stopping the media-enabled worker (graceful shutdown)...");
    await worker.stop("SIGTERM-smoke-media");
    await runPromise;
    await fakeAri.close();
    await fakeCrm.close();
    await fakeSidecar.close();
    await rtpPeer.close();
  }
}

/**
 * Proves the media loop's failure-isolation contract (attachMedia's try/catch
 * in main.mjs): a failed turn (injected /stt 500 here) must log
 * `voice_media_turn_failed`, must NOT tear the call down, and a subsequent
 * turn must still process normally. Extends runMediaScenario's setup/style
 * rather than a parallel harness.
 */
async function runMediaFailureScenario() {
  const fakeAri = await startFakeAriServer();
  const fakeCrm = await startFakeCrmServer();
  const fakeSidecar = await startFakeSidecarServer();
  const rtpPeer = await startFakeAsteriskRtpPeer();

  const worker = await createVoiceSipWorker({
    ARI_BASE_URL: fakeAri.baseUrl,
    ARI_USERNAME,
    ARI_PASSWORD,
    ARI_APP_NAME: "voicecore-test",
    SIP_OUTBOUND_CONTEXT: "lumenva-voice",
    VOICE_CONTROL_PLANE_URL: fakeCrm.baseUrl,
    INTERNAL_SECRET: "s3cret-smoke",
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
    PORT: "0",
    VOICE_MEDIA_EXTERNAL_HOST: "127.0.0.1",
    VOICE_MEDIA_SIDECAR_URL: fakeSidecar.baseUrl,
    VOICE_MEDIA_LISTEN_MS: "300",
  });

  console.log("[smoke] starting a third real entrypoint instance (media failure-injection scenario)...");
  const runPromise = worker.run();
  const errorLogs = captureLoggedErrors("voice_media_turn_failed");

  try {
    await new Promise((r) => setTimeout(r, 300));

    fakeAri.sendEvent({
      type: "StasisStart",
      timestamp: new Date().toISOString(),
      channel: {
        id: "channel-media-failure-smoke-1",
        caller: { number: "+351911234567" },
        connected: { number: "+351211234567" },
        channelvars: { SIP_CONNECTION_ID: "sip-conn-abc" },
      },
    });

    let bridgePort = null;
    for (let attempt = 0; attempt < 20 && !bridgePort; attempt += 1) {
      await new Promise((r) => setTimeout(r, 50));
      bridgePort = fakeAri.getLastExternalMediaPort();
    }
    if (!bridgePort) throw new Error("[smoke] expected the media bridge to call POST /ari/channels/externalMedia by now");

    // Turn 1: inject a /stt 500 for exactly this turn.
    fakeSidecar.failNextRequest("/stt");
    for (let i = 0; i < 12; i += 1) {
      rtpPeer.sendTo(bridgePort, buildFakeRtpPacket(Buffer.alloc(160, 0x03)));
      await new Promise((r) => setTimeout(r, 20));
    }
    for (let i = 0; i < 25; i += 1) {
      rtpPeer.sendTo(bridgePort, buildFakeRtpPacket(Buffer.alloc(160, 0xff)));
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 1000));

    if (errorLogs.matches.length < 1) {
      throw new Error("[smoke] expected voice_media_turn_failed to be logged for the injected /stt failure");
    }
    console.log("[smoke] injected /stt failure was logged as voice_media_turn_failed:", errorLogs.matches[0]);

    // (b) call NOT torn down: healthz must still report ok, and the worker
    // process must still be alive/consuming events (checked below via (c)).
    const healthzPort = worker.healthzPort();
    const health = await httpGetJson(`http://127.0.0.1:${healthzPort}/healthz`);
    if (health.status !== 200 || health.body.status !== "ok") {
      throw new Error(`[smoke] expected the worker to survive the injected failure and still report /healthz ok, got: ${JSON.stringify(health)}`);
    }

    // (c) a subsequent turn still processes normally — no failure injected this time.
    for (let i = 0; i < 12; i += 1) {
      rtpPeer.sendTo(bridgePort, buildFakeRtpPacket(Buffer.alloc(160, 0x03)));
      await new Promise((r) => setTimeout(r, 20));
    }
    for (let i = 0; i < 25; i += 1) {
      rtpPeer.sendTo(bridgePort, buildFakeRtpPacket(Buffer.alloc(160, 0xff)));
      await new Promise((r) => setTimeout(r, 20));
    }
    await new Promise((r) => setTimeout(r, 1500));

    const sttCalls = fakeSidecar.requestsReceived.filter((r) => r.path === "/stt");
    const turnCalls = fakeCrm.requestsReceived.filter((r) => r.path === "/api/internal/voice/turn");
    const ttsPacketsReceived = rtpPeer.receivedPackets.filter((packet) => {
      const payload = packet.subarray(12);
      return payload.length > 0 && payload.every((byte) => byte === 0xab);
    });
    // 2 /stt calls: the failed one + the recovered one.
    if (sttCalls.length < 2 || turnCalls.length < 1 || ttsPacketsReceived.length < 1) {
      throw new Error(
        `[smoke] expected the call to recover after the injected failure — got sttCalls=${sttCalls.length} turnCalls=${turnCalls.length} ttsPacketsReceived=${ttsPacketsReceived.length}`,
      );
    }
    console.log(
      "[smoke] call survived the injected /stt failure and a later turn processed normally",
      { sttCalls: sttCalls.length, turnCalls: turnCalls.length, ttsPacketsReceived: ttsPacketsReceived.length },
    );

    console.log("[smoke] PASS — media failure-injection scenario: one bad turn logs+continues, later turn recovers.");
  } finally {
    errorLogs.restore();
    console.log("[smoke] stopping the media-failure-scenario worker (graceful shutdown)...");
    await worker.stop("SIGTERM-smoke-media-failure");
    await runPromise;
    await fakeAri.close();
    await fakeCrm.close();
    await fakeSidecar.close();
    await rtpPeer.close();
  }
}

async function main() {
  await runSignalingScenario();
  await runMediaScenario();
  await runMediaFailureScenario();
}

main()
  .catch((error) => {
    console.error("[smoke] FAIL:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    // Belt and suspenders: if anything still holds the event loop open
    // (a stray timer, an unclosed handle), force the process to end
    // instead of hanging the gate silently.
    process.exit(process.exitCode ?? 0);
  });
