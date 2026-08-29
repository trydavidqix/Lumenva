#!/usr/bin/env -S npx tsx
// Real, long-running entrypoint for the SIP/BYOC voice worker (Fase 3).
// Run via `npx tsx workers/voice-sip-worker/main.mjs` from the repo root —
// this is a deliberate build/deploy decision (see README "Decisão de
// build"): unlike workers/voice-worker/ (a standalone npm package with its
// own Dockerfile), this process imports TypeScript directly from `lib/voice/sip/**`
// and needs the whole repo checkout + root node_modules + `tsx`. It cannot
// ship as a slim standalone container the way the Telnyx worker does.
//
// Wires together everything built in this branch's Fase 3 slices:
// AriConnection (real ARI REST+WS) -> SipGateway (validate/normalize) ->
// AsteriskAriListener (consume + auto-reconnect) -> SipEventForwarder
// (call /context + /event over real HTTP).
//
// Env vars (all required unless noted):
//   ARI_BASE_URL             e.g. http://127.0.0.1:8088
//   ARI_USERNAME
//   ARI_PASSWORD
//   ARI_APP_NAME             the Stasis application name registered in Asterisk's dialplan
//   SIP_OUTBOUND_CONTEXT     dialplan context used for outbound originate
//   VOICE_CONTROL_PLANE_URL  CRM base URL (same as the Telnyx worker's var)
//   INTERNAL_SECRET          same shared secret as the Telnyx worker
//   SUPABASE_DB_URL          read-only Postgres access for local connection->org validation (see caveat below)
//   PORT                     healthz port, default 8090
//
// Deliberate deviation from workers/voice-worker/README.md's "the worker
// has no database credentials" principle: this process DOES read
// voice_sip_connections/voice_phone_numbers directly (via the same
// createVoiceOrganizationResolver used elsewhere and covered by
// lib/voice/identity/resolve-organization.test.ts), because the SIP
// gateway's local validation (lib/voice/sip/asterisk-adapter.ts) needs to
// reject an unverified/unknown connection *before* attempting any network
// call to the CRM, and this repo has no lightweight HTTP-only endpoint for
// that check today (app/api/internal/voice/context does real resolution
// too, but also creates a voice_calls row as a side effect — not a bare
// check). This is a real, visible trade-off, not a silent violation:
// revisit if a dedicated read-only resolution endpoint is ever built.

import http from "node:http";
import { createPool } from "../../lib/agent-engine/db/pool.ts";
import { createAsteriskAriConnection } from "../../lib/voice/sip/asterisk-ari-client.ts";
import { createAsteriskSipGateway } from "../../lib/voice/sip/asterisk-adapter.ts";
import { createAsteriskAriListener } from "../../lib/voice/sip/asterisk-listener.ts";
import { createSipVoiceBrainClient } from "../../lib/voice/sip/brain-client.ts";
import { createSipEventForwarder } from "../../lib/voice/sip/event-forwarder.ts";
import { createVoiceOrganizationResolver } from "../../lib/voice/identity/resolve-organization.ts";

function log(msg, fields = {}) {
  console.info(JSON.stringify({ msg, at: new Date().toISOString(), ...fields }));
}

function logError(msg, error, fields = {}) {
  console.error(JSON.stringify({ msg, at: new Date().toISOString(), error: error instanceof Error ? error.message : String(error), ...fields }));
}

function required(env, name) {
  const value = env[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

export async function createVoiceSipWorker(env = process.env) {
  const ariBaseUrl = required(env, "ARI_BASE_URL");
  const ariUsername = required(env, "ARI_USERNAME");
  const ariPassword = required(env, "ARI_PASSWORD");
  const ariAppName = required(env, "ARI_APP_NAME");
  const outboundContext = required(env, "SIP_OUTBOUND_CONTEXT");
  const controlPlaneUrl = required(env, "VOICE_CONTROL_PLANE_URL");
  const internalSecret = required(env, "INTERNAL_SECRET");
  const dbUrl = required(env, "SUPABASE_DB_URL");
  const port = Number(env.PORT ?? "8090");
  // 0 is valid and means "let the OS assign a free port" — Node's own http.Server contract.
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("PORT must be a valid port number");

  // createPool (not a raw `new pg.Pool()`) attaches the per-client error
  // listener this repo's own pg pitfall doc requires — an idle/checkout
  // client error would otherwise crash this process outright.
  const pool = createPool(dbUrl);
  const orgResolver = createVoiceOrganizationResolver(pool);

  const connection = createAsteriskAriConnection({ baseUrl: ariBaseUrl, username: ariUsername, password: ariPassword });
  const gateway = createAsteriskSipGateway({
    directory: {
      resolveOrganizationByConnection: (connectionId, calledE164) =>
        orgResolver.resolveByConnection("asterisk", connectionId, calledE164),
    },
    ariClient: connection,
    outboundContext,
  });
  const brainClient = createSipVoiceBrainClient({ baseUrl: controlPlaneUrl, secret: internalSecret });
  const forwarder = createSipEventForwarder({ brainClient });

  let ready = false;
  let processedEvents = 0;
  let rejectedEvents = 0;
  let forwardFailures = 0;

  const healthServer = http.createServer((req, res) => {
    if (req.url === "/healthz") {
      res.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: ready ? "ok" : "starting", processedEvents, rejectedEvents, forwardFailures }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });

  let listener = null;
  let stopped = false;

  async function run() {
    listener = await createAsteriskAriListener({ connection, gateway, appName: ariAppName });
    await new Promise((resolve, reject) => {
      healthServer.listen(port, "0.0.0.0", resolve);
      healthServer.once("error", reject);
    });
    ready = true;
    log("voice_sip_worker_ready", { ariAppName, port });

    for await (const result of listener.events()) {
      if (stopped) break;
      if (result.status === "rejected") {
        rejectedEvents += 1;
        logError("voice_sip_event_rejected", result.error, { raw: result.raw });
        continue;
      }
      try {
        await forwarder.forward(result);
        processedEvents += 1;
      } catch (error) {
        // A failed CRM call must never take the listener down — log and
        // keep consuming events, same fail-open-for-availability
        // philosophy as the listener's own automatic reconnection.
        forwardFailures += 1;
        logError("voice_sip_event_forward_failed", error, { eventType: result.event.eventType, providerEventId: result.event.providerEventId });
      }
    }
  }

  async function stop(signal) {
    if (stopped) return;
    stopped = true;
    log("voice_sip_worker_shutdown", { signal });
    ready = false;
    if (listener) await listener.close();
    await new Promise((resolve) => healthServer.close(resolve));
    await pool.end();
  }

  /** Exposes the bound healthz port — needed when PORT=0 (OS-assigned) so callers/tests can reach it without guessing. */
  function healthzPort() {
    const address = healthServer.address();
    return address && typeof address === "object" ? address.port : null;
  }

  return { run, stop, healthzPort };
}

async function main() {
  const worker = await createVoiceSipWorker();
  process.on("SIGTERM", () => worker.stop("SIGTERM").then(() => process.exit(0)));
  process.on("SIGINT", () => worker.stop("SIGINT").then(() => process.exit(0)));
  await worker.run();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logError("voice_sip_worker_fatal", error);
    process.exitCode = 1;
  });
}
