import { normalizeVoiceDeliveryForLog } from "./delivery-log.mjs";

const ENVELOPE_PREFIX = "[[LUMENVA_VOICE_V1:";
const ENVELOPE_SUFFIX = "]]";
const MAX_ENVELOPE_BYTES = 512;
const DEFAULT_TTL_MS = 120_000;
const DEFAULT_MAX_RESPONSES_PER_CALL = 4;

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function positiveNumber(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number`);
  return parsed;
}

function positiveInteger(value, fallback, name) {
  const parsed = Math.floor(positiveNumber(value, fallback, name));
  if (parsed < 1) throw new Error(`${name} must be at least 1`);
  return parsed;
}

export function encodeVoiceDeliveryEnvelope(text, delivery) {
  const spokenText = String(text ?? "");
  const normalized = normalizeVoiceDeliveryForLog(delivery);
  if (!normalized) return spokenText;
  const payload = Buffer.from(JSON.stringify(normalized), "utf8").toString("base64url");
  return `${ENVELOPE_PREFIX}${payload}${ENVELOPE_SUFFIX}${spokenText}`;
}

export function decodeVoiceDeliveryEnvelope(value) {
  const raw = String(value ?? "");
  if (!raw.startsWith(ENVELOPE_PREFIX)) return { text: raw, delivery: null };

  const end = raw.indexOf(ENVELOPE_SUFFIX, ENVELOPE_PREFIX.length);
  if (end < 0 || end > MAX_ENVELOPE_BYTES) {
    // Internal control metadata must never be spoken if it is corrupted.
    return { text: "", delivery: null };
  }

  const encoded = raw.slice(ENVELOPE_PREFIX.length, end);
  const text = raw.slice(end + ENVELOPE_SUFFIX.length);
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return { text, delivery: normalizeVoiceDeliveryForLog(parsed) };
  } catch {
    return { text, delivery: null };
  }
}

export function resolveDeliverySpeed(delivery, baseSpeed = 1) {
  const base = positiveNumber(baseSpeed, 1, "baseSpeed");
  const normalized = normalizeVoiceDeliveryForLog(delivery);
  if (!normalized) return base;

  const factor = normalized.pace === "slow" ? 0.92 : normalized.pace === "fast" ? 1.06 : 1;
  const resolved = Math.max(0.75, Math.min(1.25, base * factor));
  return Math.round(resolved * 1000) / 1000;
}

export function createCallDeliveryContext({
  ttlMs = DEFAULT_TTL_MS,
  maxResponsesPerCall = DEFAULT_MAX_RESPONSES_PER_CALL,
  now = Date.now,
} = {}) {
  const ttl = positiveNumber(ttlMs, DEFAULT_TTL_MS, "ttlMs");
  const maxResponses = positiveInteger(
    maxResponsesPerCall,
    DEFAULT_MAX_RESPONSES_PER_CALL,
    "maxResponsesPerCall",
  );
  if (typeof now !== "function") throw new Error("delivery context now must be a function");

  const calls = new Map();

  function purge(callId) {
    const entries = calls.get(callId);
    if (!entries) return [];
    const cutoff = now() - ttl;
    const fresh = entries.filter((entry) => entry.recordedAt > cutoff);
    if (fresh.length) calls.set(callId, fresh);
    else calls.delete(callId);
    return fresh;
  }

  function recordDelivery({ callId, text, delivery }) {
    const id = String(callId ?? "").trim();
    const responseText = normalizeText(text);
    const normalizedDelivery = normalizeVoiceDeliveryForLog(delivery);
    if (!id || !responseText || !normalizedDelivery) return false;

    const entries = purge(id);
    entries.push({ responseText, delivery: normalizedDelivery, recordedAt: now() });
    if (entries.length > maxResponses) entries.splice(0, entries.length - maxResponses);
    calls.set(id, entries);
    return true;
  }

  function decorateSentence(callId, text) {
    const raw = String(text ?? "");
    const id = String(callId ?? "").trim();
    const sentence = normalizeText(raw);
    if (!id || !sentence) return raw;

    const entries = purge(id);
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry.responseText.includes(sentence)) {
        return encodeVoiceDeliveryEnvelope(raw, entry.delivery);
      }
    }

    // Fail safe: if the sentence cannot be tied to a known reply for this call,
    // keep the original text and use the TTS provider's default delivery.
    return raw;
  }

  function clearDelivery(callId) {
    const id = String(callId ?? "").trim();
    if (id) calls.delete(id);
  }

  return {
    recordDelivery,
    decorateSentence,
    clearDelivery,
    size() {
      for (const callId of calls.keys()) purge(callId);
      return calls.size;
    },
  };
}
