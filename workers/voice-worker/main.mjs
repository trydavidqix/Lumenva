import {
  Patter,
  Telnyx,
  SileroVAD,
} from "getpatter";
import { createVoiceBrainClient } from "./brain-client.mjs";
import {
  activeCallCount,
  deleteCallContext,
  extractPatterCallEndpoints,
  getCallContext,
  putCallContext,
} from "./call-context.mjs";
import { startVoiceControlServer } from "./control-server.mjs";
import { normalizeVoiceDeliveryForLog } from "./delivery-log.mjs";
import { createPendingOutboundRegistry } from "./pending-outbound.mjs";
import { createSpeachesHealthCheck } from "./speaches-health.mjs";
import { SpeachesFasterWhisperSTT } from "./speaches-stt.mjs";
import { SpeachesFailoverTTS, SpeachesLocalTTS } from "./speaches-tts.mjs";

function required(name) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function optional(name) {
  const value = process.env[name];
  return value?.trim() ? value.trim() : undefined;
}

function enabled(name) {
  return /^(1|true|yes|on)$/i.test(process.env[name] ?? "");
}

function positiveNumberEnv(name, fallback) {
  const raw = optional(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
  return value;
}

function number(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function metricsFromCallEnd(data) {
  const metrics = data?.metrics;
  if (!metrics || typeof metrics !== "object") return undefined;
  const latency = metrics.latency_avg ?? {};
  const cost = metrics.cost ?? {};
  const normalized = {
    carrierMs: number(latency.carrier_ms),
    sttMs: number(latency.stt_ms),
    agentMs: number(latency.llm_total_ms ?? latency.llm_ms),
    ttsMs: number(latency.tts_ms),
    e2eMs: number(latency.total_ms),
    interruptionMs: number(latency.bargein_ms),
    carrierCostCents: number(cost.telephony) === undefined ? undefined : cost.telephony * 100,
    sttCostCents: number(cost.stt) === undefined ? undefined : cost.stt * 100,
    ttsCostCents: number(cost.tts) === undefined ? undefined : cost.tts * 100,
  };
  return Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined));
}

function createLocalTts({ baseUrl }) {
  const primary = new SpeachesLocalTTS({
    baseUrl,
    model: required("VOICE_LOCAL_TTS_PRIMARY_MODEL"),
    voice: required("VOICE_LOCAL_TTS_PRIMARY_VOICE"),
    speed: positiveNumberEnv("VOICE_LOCAL_TTS_PRIMARY_SPEED", 1),
    providerKey: "kokoro-local",
  });

  const fallbackModel = optional("VOICE_LOCAL_TTS_FALLBACK_MODEL");
  const fallbackVoice = optional("VOICE_LOCAL_TTS_FALLBACK_VOICE");
  if (Boolean(fallbackModel) !== Boolean(fallbackVoice)) {
    throw new Error("VOICE_LOCAL_TTS_FALLBACK_MODEL and VOICE_LOCAL_TTS_FALLBACK_VOICE must be configured together");
  }
  if (!fallbackModel || !fallbackVoice) return primary;

  const fallback = new SpeachesLocalTTS({
    baseUrl,
    model: fallbackModel,
    voice: fallbackVoice,
    speed: positiveNumberEnv("VOICE_LOCAL_TTS_FALLBACK_SPEED", 1),
    providerKey: "piper-local",
  });
  return new SpeachesFailoverTTS({ primary, fallback });
}

const liveEnabled = enabled("VOICE_LIVE_ENABLED");
const phoneNumber = required("TELNYX_PHONE_NUMBER");
const webhookUrl = required("VOICE_WEBHOOK_HOST");
const localSpeechUrl = optional("VOICE_LOCAL_SPEECH_URL") ?? "http://127.0.0.1:8000";
const port = Number(process.env.PORT ?? 8080);
const controlPort = Number(process.env.VOICE_CONTROL_PORT ?? 8081);
if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error("PORT must be a valid TCP port");
if (!Number.isInteger(controlPort) || controlPort <= 0 || controlPort > 65535 || controlPort === port) {
  throw new Error("VOICE_CONTROL_PORT must be a different valid TCP port");
}

process.env.PATTER_TELEMETRY_DISABLED = "1";
process.env.PATTER_DASHBOARD_NOTIFY = "0";
process.env.PATTER_BIND_HOST = process.env.PATTER_BIND_HOST ?? "0.0.0.0";

const speechHealth = createSpeachesHealthCheck({
  baseUrl: localSpeechUrl,
  timeoutMs: positiveNumberEnv("VOICE_LOCAL_SPEECH_HEALTH_TIMEOUT_MS", 2_000),
});
if (liveEnabled && !(await speechHealth())) {
  throw new Error("local_speech_unavailable_at_startup");
}

const brain = createVoiceBrainClient();
const workerPolicy = await brain.resolveWorkerConfig({ phone_e164: phoneNumber });
const recordingEnabled = workerPolicy.recording_enabled === true && workerPolicy.recording_requires_disclosure !== true;
const pendingOutbound = createPendingOutboundRegistry({ ttlMs: Number(process.env.VOICE_OUTBOUND_PENDING_TTL_MS ?? 60_000) });
const phone = new Patter({
  carrier: new Telnyx({
    apiKey: required("TELNYX_API_KEY"),
    connectionId: required("TELNYX_CONNECTION_ID"),
    publicKey: required("TELNYX_PUBLIC_KEY"),
  }),
  phoneNumber,
  webhookUrl,
  persist: false,
  telemetry: false,
});

const stt = new SpeachesFasterWhisperSTT({
  baseUrl: localSpeechUrl,
  model: required("VOICE_LOCAL_STT_MODEL"),
  language: optional("VOICE_LOCAL_STT_LANGUAGE") ?? workerPolicy.locale ?? "pt",
  timeoutMs: positiveNumberEnv("VOICE_LOCAL_STT_TIMEOUT_MS", 20_000),
  maxUtteranceSeconds: positiveNumberEnv("VOICE_LOCAL_STT_MAX_UTTERANCE_SECONDS", 30),
});
const tts = createLocalTts({ baseUrl: localSpeechUrl });
const minSilenceDuration = positiveNumberEnv("VOICE_VAD_MIN_SILENCE_SECONDS", 0.5);
if (minSilenceDuration < 0.1 || minSilenceDuration > 2) {
  throw new Error("VOICE_VAD_MIN_SILENCE_SECONDS must be between 0.1 and 2 seconds");
}
const vad = await SileroVAD.forPhoneCall({
  minSilenceDuration,
  forceCpu: true,
});

const agent = phone.agent({
  stt,
  tts,
  vad,
  systemPrompt: "You are the Lumenva media shell. Business reasoning is provided externally.",
  firstMessage: "",
});

async function onCallStart(data) {
  if (!liveEnabled) throw new Error("voice_live_disabled");
  if (!(await speechHealth())) throw new Error("local_speech_unavailable");
  const endpoints = extractPatterCallEndpoints(data);
  const direction = endpoints.caller === phoneNumber ? "outbound" : "inbound";
  let context;
  if (direction === "outbound") {
    const pending = pendingOutbound.consume(endpoints.called);
    if (!pending) throw new Error("outbound_context_missing_or_ambiguous");
    context = { voice_call_id: pending.voiceCallId };
  } else {
    context = await brain.resolveContext({
      provider_call_id: endpoints.callId,
      caller_e164: endpoints.caller,
      called_e164: endpoints.called,
      direction,
    });
  }
  putCallContext(endpoints.callId, context);
  await brain.recordEvent({
    voice_call_id: context.voice_call_id,
    technical_phone_e164: phoneNumber,
    state: "active",
    provider_call_id: endpoints.callId,
    provider_event_id: `${endpoints.callId}:active`,
    occurred_at: new Date().toISOString(),
  });
}

async function onMessage(message) {
  if (!liveEnabled) throw new Error("voice_live_disabled");
  const context = getCallContext(message.callId);
  if (!context) throw new Error("voice_call_context_missing");
  const transcript = String(message.text ?? "").trim();
  if (!transcript) return "";
  const result = await brain.runTurn({
    voice_call_id: context.voice_call_id,
    technical_phone_e164: phoneNumber,
    transcript,
  });
  if (result.kind !== "reply" || typeof result.text !== "string" || !result.text.trim()) {
    throw new Error(`voice_turn_blocked:${result.reason ?? "unknown"}`);
  }
  const delivery = normalizeVoiceDeliveryForLog(result.delivery);
  if (delivery) {
    process.stdout.write(JSON.stringify({
      event: "lumenva_voice_delivery",
      voice_call_id: context.voice_call_id,
      ...delivery,
    }) + "\n");
  }
  return result.text.trim();
}

async function onCallEnd(data) {
  const callId = String(data?.callId ?? data?.call_id ?? data?.id ?? "").trim();
  if (!callId) return;
  const context = getCallContext(callId);
  try {
    if (context) {
      const metrics = metricsFromCallEnd(data);
      await brain.recordEvent({
        voice_call_id: context.voice_call_id,
        technical_phone_e164: phoneNumber,
        state: "completed",
        provider_call_id: callId,
        provider_event_id: `${callId}:completed`,
        occurred_at: new Date().toISOString(),
        ...(metrics ? { metrics } : {}),
      });
    }
  } finally {
    deleteCallContext(callId);
  }
}

await phone.serve({
  agent,
  port,
  dashboard: false,
  tunnel: false,
  recording: recordingEnabled,
  onCallStart,
  onCallEnd,
  onMessage,
});
const controlServer = await startVoiceControlServer({
  phone,
  agent,
  secret: required("INTERNAL_SECRET"),
  liveEnabled,
  port: controlPort,
  pendingOutbound,
  readinessCheck: speechHealth,
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write(JSON.stringify({ event: "lumenva_voice_worker_shutdown", signal, active_calls: activeCallCount() }) + "\n");
  await new Promise((resolve) => controlServer.close(() => resolve()));
  await phone.disconnect();
  process.exit(0);
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

process.stdout.write(JSON.stringify({
  event: "lumenva_voice_worker_ready",
  port,
  control_port: controlPort,
  live_enabled: liveEnabled,
  speech_runtime: "local",
  stt_provider: "faster-whisper-local",
  tts_provider: "local-speech",
  vad_provider: "silero-local",
  recording_enabled: recordingEnabled,
  recording_blocked_by_disclosure_policy:
    workerPolicy.recording_enabled === true && workerPolicy.recording_requires_disclosure === true,
  active_calls: activeCallCount(),
}) + "\n");
