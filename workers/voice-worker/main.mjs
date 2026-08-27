import {
  Patter,
  Telnyx,
  DeepgramSTT,
  ElevenLabsTTS,
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

function required(name) {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function enabled(name) {
  return /^(1|true|yes|on)$/i.test(process.env[name] ?? "");
}

const liveEnabled = enabled("VOICE_LIVE_ENABLED");
const phoneNumber = required("TELNYX_PHONE_NUMBER");
const webhookUrl = required("VOICE_WEBHOOK_HOST");
const port = Number(process.env.PORT ?? 8080);
const controlPort = Number(process.env.VOICE_CONTROL_PORT ?? 8081);
if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error("PORT must be a valid TCP port");
if (!Number.isInteger(controlPort) || controlPort <= 0 || controlPort > 65535 || controlPort === port) {
  throw new Error("VOICE_CONTROL_PORT must be a different valid TCP port");
}

process.env.PATTER_TELEMETRY_DISABLED = "1";
process.env.PATTER_DASHBOARD_NOTIFY = "0";
process.env.PATTER_BIND_HOST = process.env.PATTER_BIND_HOST ?? "0.0.0.0";

const brain = createVoiceBrainClient();
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

const agent = phone.agent({
  stt: new DeepgramSTT({
    apiKey: required("DEEPGRAM_API_KEY"),
    language: process.env.VOICE_STT_LANGUAGE ?? "pt",
  }),
  tts: new ElevenLabsTTS({
    apiKey: required("ELEVENLABS_API_KEY"),
    voiceId: required("ELEVENLABS_VOICE_ID"),
  }),
  systemPrompt: "You are the Lumenva media shell. Business reasoning is provided externally.",
  firstMessage: "",
});

async function onCallStart(data) {
  if (!liveEnabled) throw new Error("voice_live_disabled");
  const endpoints = extractPatterCallEndpoints(data);
  const direction = endpoints.caller === phoneNumber ? "outbound" : "inbound";
  const context = await brain.resolveContext({
    provider_call_id: endpoints.callId,
    caller_e164: endpoints.caller,
    called_e164: endpoints.called,
    direction,
  });
  putCallContext(endpoints.callId, context);
}

async function onMessage(message) {
  if (!liveEnabled) throw new Error("voice_live_disabled");
  const context = getCallContext(message.callId);
  if (!context) throw new Error("voice_call_context_missing");
  const transcript = String(message.text ?? "").trim();
  if (!transcript) return "";
  const result = await brain.runTurn({ voice_call_id: context.voice_call_id, transcript });
  if (result.kind !== "reply" || typeof result.text !== "string" || !result.text.trim()) {
    throw new Error(`voice_turn_blocked:${result.reason ?? "unknown"}`);
  }
  return result.text.trim();
}

async function onCallEnd(data) {
  const callId = String(data?.callId ?? data?.call_id ?? data?.id ?? "").trim();
  if (callId) deleteCallContext(callId);
}

await phone.serve({
  agent,
  port,
  dashboard: false,
  tunnel: false,
  onCallStart,
  onCallEnd,
  onMessage,
});
await startVoiceControlServer({
  phone,
  agent,
  secret: required("INTERNAL_SECRET"),
  liveEnabled,
  port: controlPort,
});

process.stdout.write(JSON.stringify({
  event: "lumenva_voice_worker_ready",
  port,
  control_port: controlPort,
  live_enabled: liveEnabled,
  active_calls: activeCallCount(),
}) + "\n");
