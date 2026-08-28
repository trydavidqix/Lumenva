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
    const server = http.createServer((req, res) => {
      const expectedAuth = `Basic ${Buffer.from(`${ARI_USERNAME}:${ARI_PASSWORD}`).toString("base64")}`;
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
        callback(url.searchParams.get("api_key") === `${ARI_USERNAME}:${ARI_PASSWORD}`, 401, "unauthorized");
      },
    });
    wss.on("connection", (socket) => { activeSocket = socket; });
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

async function httpGetJson(url) {
  const response = await fetch(url);
  return { status: response.status, body: await response.json() };
}

async function main() {
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

  console.log("[smoke] stopping the worker (graceful shutdown)...");
  await worker.stop("SIGTERM-smoke");
  await runPromise;

  await fakeAri.close();
  await fakeCrm.close();
  console.log("[smoke] PASS — real entrypoint: env parsing -> real Postgres tenant resolution -> real HTTP forward -> graceful shutdown.");
}

main().catch((error) => {
  console.error("[smoke] FAIL:", error);
  process.exitCode = 1;
});
