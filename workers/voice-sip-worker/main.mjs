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
// Media env vars (OPTIONAL — media is off unless VOICE_MEDIA_EXTERNAL_HOST is set; a worker
// without them keeps running signaling-only, exactly like before this slice):
//   VOICE_MEDIA_EXTERNAL_HOST  IP/host Asterisk uses to send RTP back — same role as
//                              `advertisedHost` in createAsteriskRtpMediaBridge. Presence of this
//                              var is what turns media on.
//   VOICE_MEDIA_SIDECAR_URL    base URL of the Python STT/TTS sidecar. Default http://127.0.0.1:8500
//                              (same port already proven against the real sidecar).
//   VOICE_MEDIA_LISTEN_MS     how long each capture window listens for RTP before running a
//                              turn. Default 4000 (same value already proven).
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
import { createAsteriskRtpMediaBridge } from "../../lib/voice/sip/rtp-media-bridge.ts";
import { createSidecarSpeechAdapter } from "../../lib/voice/media/sidecar-speech-adapter.ts";
import { createContinuousSender } from "../../lib/voice/media/continuous-sender.ts";
import { createRtpPacketBuilder, parseRtpPacket } from "../../lib/voice/media/rtp-frame.ts";

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

  // Media is OPTIONAL: a worker without VOICE_MEDIA_EXTERNAL_HOST keeps running
  // signaling-only, exactly as before this slice.
  const mediaEnabled = Boolean(env.VOICE_MEDIA_EXTERNAL_HOST);
  const mediaSidecarUrl = env.VOICE_MEDIA_SIDECAR_URL ?? "http://127.0.0.1:8500";
  const mediaListenMs = Number(env.VOICE_MEDIA_LISTEN_MS ?? "4000");
  const speech = mediaEnabled ? createSidecarSpeechAdapter({ baseUrl: mediaSidecarUrl }) : null;
  const rtpBridge = mediaEnabled
    ? createAsteriskRtpMediaBridge({ ari: connection, appName: ariAppName, advertisedHost: env.VOICE_MEDIA_EXTERNAL_HOST })
    : null;

  const activeMediaSessions = new Map(); // channelId -> { rtpSession, sender, detach() }

  /** Attends one call: capture -> STT -> Agent OS turn -> TTS -> speak, looping until detached. */
  async function attachMedia(channelId, voiceCallId, technicalPhoneE164) {
    if (!mediaEnabled || activeMediaSessions.has(channelId)) return;
    const rtpSession = await rtpBridge.start({ callChannelId: channelId });
    const sender = createContinuousSender({
      send: (packet) => rtpSession.send(packet),
      builder: createRtpPacketBuilder(),
    });
    let stopped = false;
    const session = {
      rtpSession,
      sender,
      async detach() {
        stopped = true;
        sender.stop();
        await rtpSession.close().catch(() => undefined);
        activeMediaSessions.delete(channelId);
      },
    };
    activeMediaSessions.set(channelId, session);

    // Exactly ONE consumer drains rtpSession.packets() for the session's
    // whole lifetime — never a fresh iterator per turn. RtpMediaSession's
    // internal waiters queue (lib/voice/sip/rtp-media-bridge.ts) is a plain
    // FIFO: an abandoned `.next()` call (e.g. from racing it against a
    // per-turn timeout with Promise.race, which never cancels the losing
    // branch) stays registered and steals the NEXT turn's first real
    // packet, silently dropping it. A single ongoing `for await` here means
    // `.next()` is always eventually consumed by the same loop, so no
    // waiter is ever abandoned. The turn boundary is a plain timer that
    // reads-and-clears a local buffer instead of racing the iterator.
    const inboundBuffer = [];
    (async () => {
      for await (const packet of rtpSession.packets()) {
        if (stopped) break;
        const parsed = parseRtpPacket(packet);
        if (parsed) inboundBuffer.push(parsed.payload);
      }
    })().catch((error) => logError("voice_media_capture_loop_crashed", error, { channelId }));

    (async () => {
      while (!stopped) {
        await new Promise((resolve) => setTimeout(resolve, mediaListenMs));
        if (stopped) break;
        const captured = inboundBuffer.splice(0, inboundBuffer.length);
        if (captured.length === 0) continue;
        try {
          const controller = new AbortController();
          async function* asFrames() {
            for (const payload of captured) {
              yield { data: payload, encoding: "mulaw", sampleRateHz: 8000, channels: 1, timestampMs: 0 };
            }
          }
          let heardText = "";
          for await (const event of speech.stt.transcribe(asFrames(), { locale: "pt-PT", signal: controller.signal })) {
            if (event.type === "final") heardText = event.text;
          }
          if (!heardText.trim()) continue;
          const turnResult = await brainClient.runTurn({
            voice_call_id: voiceCallId,
            technical_phone_e164: technicalPhoneE164,
            transcript: heardText,
          });
          const replyText = turnResult.kind === "reply"
            ? turnResult.text
            : "Desculpe, não posso ajudar com isso agora.";
          const playback = await speech.tts.synthesize(replyText, { locale: "pt-PT", signal: controller.signal });
          for await (const frame of playback.audio) {
            sender.enqueue(Buffer.from(frame.data));
          }
        } catch (error) {
          // Same availability philosophy as the rest of the worker: one
          // failed turn must never take down the call nor the process.
          //
          // CONSCIOUS divergence from the spec: the original design expected
          // "fall back to a recorded apology" when the sidecar is down. That
          // would need a local, repo-versioned audio asset (not depending on
          // the SAME sidecar that just failed to synthesize the apology) —
          // out of scope for this task. Here, a failed STT/turn/TTS becomes
          // SILENCE just for that turn (the call continues, the next turn
          // tries again), not a spoken phrase. If Task 8 (a real call) shows
          // this is too bad a UX, that's a follow-up — not a reason to
          // reopen this task without measuring first.
          logError("voice_media_turn_failed", error, { channelId, voiceCallId });
        }
      }
    })().catch((error) => logError("voice_media_loop_crashed", error, { channelId }));

    return session;
  }

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
        if (mediaEnabled && result.status === "normalized") {
          const { event } = result;
          const channelId = event.providerEventId; // asterisk-adapter.ts: providerEventId === channelId
          if (event.eventType === "StasisStart") {
            const technicalE164 = event.direction === "inbound" ? event.calledE164 : event.callerE164;
            const context = await brainClient.resolveContext({
              provider_call_id: event.providerEventId,
              connection_id: event.connectionId,
              caller_e164: event.callerE164,
              called_e164: event.calledE164,
              direction: event.direction,
            });
            await attachMedia(channelId, context.voice_call_id, technicalE164).catch((error) =>
              logError("voice_media_attach_failed", error, { channelId }),
            );
          } else if (event.eventType === "StasisEnd" || event.eventType === "ChannelHangupRequest") {
            const session = activeMediaSessions.get(channelId);
            if (session) await session.detach().catch((error) => logError("voice_media_detach_failed", error, { channelId }));
          }
        }
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
    for (const session of activeMediaSessions.values()) await session.detach().catch(() => undefined);
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
