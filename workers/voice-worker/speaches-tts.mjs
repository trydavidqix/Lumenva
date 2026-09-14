import { decodeVoiceDeliveryEnvelope, resolveDeliverySpeed } from "./delivery-context.mjs";

const DEFAULT_SAMPLE_RATE = 16_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_CHUNK_BYTES = 3_200;

function normalizeBaseUrl(value) {
  const url = String(value ?? "").trim().replace(/\/+$/, "");
  if (!url) throw new Error("Speaches TTS baseUrl is required");
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Speaches TTS baseUrl must use http(s)");
  return parsed.toString().replace(/\/$/, "");
}

function positiveNumber(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number`);
  return parsed;
}

export class SpeachesLocalTTS {
  static providerKey = "local-speech";

  constructor({
    baseUrl,
    model,
    voice,
    speed = 1,
    sampleRate = DEFAULT_SAMPLE_RATE,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    chunkBytes = DEFAULT_CHUNK_BYTES,
    fetchImpl = globalThis.fetch,
    providerKey = "local-speech",
  } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.model = String(model ?? "").trim();
    this.voice = String(voice ?? "").trim();
    if (!this.model) throw new Error("Speaches TTS model is required");
    if (!this.voice) throw new Error("Speaches TTS voice is required");
    this.speed = positiveNumber(speed, 1, "speed");
    this.sampleRate = positiveNumber(sampleRate, DEFAULT_SAMPLE_RATE, "sampleRate");
    this.timeoutMs = positiveNumber(timeoutMs, DEFAULT_TIMEOUT_MS, "timeoutMs");
    this.chunkBytes = Math.max(320, Math.floor(positiveNumber(chunkBytes, DEFAULT_CHUNK_BYTES, "chunkBytes")));
    if (typeof fetchImpl !== "function") throw new Error("Speaches TTS fetch implementation is required");
    this.fetchImpl = fetchImpl;
    this.providerKey = String(providerKey || "local-speech");
    // Patter recognizes PCM 16 kHz and will perform carrier-specific encoding.
    this.outputFormat = "pcm_16000";
  }

  setTelephonyCarrier() {
    // Intentionally no-op: Speaches is requested at PCM16/16k and Patter owns
    // the final carrier codec conversion.
  }

  async synthesize(text) {
    const chunks = [];
    for await (const chunk of this.synthesizeStream(text)) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  async *synthesizeStream(text) {
    const decoded = decodeVoiceDeliveryEnvelope(text);
    const input = decoded.text.trim();
    if (!input) throw new Error("local_tts_empty_text");
    const speed = resolveDeliverySpeed(decoded.delivery, this.speed);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("local_tts_timeout")), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/v1/audio/speech`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          input,
          voice: this.voice,
          response_format: "pcm",
          sample_rate: this.sampleRate,
          speed,
          stream_format: "audio",
        }),
        signal: controller.signal,
      });
      if (!response?.ok) {
        const detail = (await response?.text?.().catch(() => "")) ?? "";
        throw new Error(`local_tts_http_${response?.status ?? "unknown"}:${detail.slice(0, 240)}`);
      }
      if (!response.body) {
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length) yield* this.rechunk(bytes);
        return;
      }
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value?.length) continue;
          yield* this.rechunk(Buffer.from(value));
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    } catch (error) {
      if (controller.signal.aborted) throw new Error("local_tts_timeout");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  *rechunk(buffer) {
    for (let offset = 0; offset < buffer.length; offset += this.chunkBytes) {
      yield buffer.subarray(offset, Math.min(offset + this.chunkBytes, buffer.length));
    }
  }
}

export class SpeachesFailoverTTS {
  static providerKey = "local-speech-failover";

  constructor({ primary, fallback = null } = {}) {
    if (!primary || typeof primary.synthesizeStream !== "function") {
      throw new Error("SpeachesFailoverTTS primary provider is required");
    }
    if (fallback && typeof fallback.synthesizeStream !== "function") {
      throw new Error("SpeachesFailoverTTS fallback must implement synthesizeStream");
    }
    this.primary = primary;
    this.fallback = fallback;
    this.outputFormat = primary.outputFormat ?? "pcm_16000";
  }

  setTelephonyCarrier(carrier) {
    this.primary.setTelephonyCarrier?.(carrier);
    this.fallback?.setTelephonyCarrier?.(carrier);
  }

  async synthesize(text) {
    const chunks = [];
    for await (const chunk of this.synthesizeStream(text)) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  async *synthesizeStream(text) {
    let emitted = false;
    try {
      for await (const chunk of this.primary.synthesizeStream(text)) {
        emitted = true;
        yield chunk;
      }
      return;
    } catch (error) {
      // Switching voices after audio has already reached the caller would
      // duplicate/mix a sentence. Fallback is safe only before first audio.
      if (emitted || !this.fallback) throw error;
    }

    for await (const chunk of this.fallback.synthesizeStream(text)) yield chunk;
  }
}
