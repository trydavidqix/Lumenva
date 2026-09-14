const DEFAULT_SAMPLE_RATE = 16_000;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_UTTERANCE_SECONDS = 30;

function normalizeBaseUrl(value) {
  const url = String(value ?? "").trim().replace(/\/+$/, "");
  if (!url) throw new Error("Speaches STT baseUrl is required");
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Speaches STT baseUrl must use http(s)");
  return parsed.toString().replace(/\/$/, "");
}

function positiveNumber(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${name} must be a positive number`);
  return parsed;
}

export function pcm16MonoToWav(pcm, sampleRate = DEFAULT_SAMPLE_RATE) {
  if (!Buffer.isBuffer(pcm)) throw new TypeError("pcm must be a Buffer");
  if (pcm.length % 2 !== 0) throw new Error("PCM16 buffer must contain an even number of bytes");
  const rate = positiveNumber(sampleRate, DEFAULT_SAMPLE_RATE, "sampleRate");
  const channels = 1;
  const bitsPerSample = 16;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = rate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export class SpeachesFasterWhisperSTT {
  static providerKey = "faster-whisper-local";

  constructor({
    baseUrl,
    model,
    language = "pt",
    sampleRate = DEFAULT_SAMPLE_RATE,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxUtteranceSeconds = DEFAULT_MAX_UTTERANCE_SECONDS,
    fetchImpl = globalThis.fetch,
  } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.model = String(model ?? "").trim();
    if (!this.model) throw new Error("Speaches STT model is required");
    this.language = String(language ?? "").trim() || "pt";
    this.sampleRate = positiveNumber(sampleRate, DEFAULT_SAMPLE_RATE, "sampleRate");
    this.timeoutMs = positiveNumber(timeoutMs, DEFAULT_TIMEOUT_MS, "timeoutMs");
    this.maxUtteranceSeconds = positiveNumber(
      maxUtteranceSeconds,
      DEFAULT_MAX_UTTERANCE_SECONDS,
      "maxUtteranceSeconds",
    );
    if (typeof fetchImpl !== "function") throw new Error("Speaches STT fetch implementation is required");
    this.fetchImpl = fetchImpl;
    this.maxBufferBytes = Math.floor(this.sampleRate * 2 * this.maxUtteranceSeconds);
    this.transcriptCallbacks = new Set();
    this.errorCallbacks = new Set();
    this.audioChunks = [];
    this.audioBytes = 0;
    this.connected = false;
    this.closed = false;
    this.flushTail = Promise.resolve();
  }

  clone() {
    return new SpeachesFasterWhisperSTT({
      baseUrl: this.baseUrl,
      model: this.model,
      language: this.language,
      sampleRate: this.sampleRate,
      timeoutMs: this.timeoutMs,
      maxUtteranceSeconds: this.maxUtteranceSeconds,
      fetchImpl: this.fetchImpl,
    });
  }

  async connect() {
    this.audioChunks = [];
    this.audioBytes = 0;
    this.closed = false;
    this.connected = true;
  }

  sendAudio(audio) {
    if (!this.connected || this.closed || !Buffer.isBuffer(audio) || audio.length === 0) return;
    if (audio.length % 2 !== 0) {
      this.emitError(new Error("local_stt_invalid_pcm16_frame"));
      return;
    }
    if (this.audioBytes + audio.length > this.maxBufferBytes) {
      this.audioChunks = [];
      this.audioBytes = 0;
      this.emitError(new Error("local_stt_utterance_buffer_limit_exceeded"));
      return;
    }
    this.audioChunks.push(Buffer.from(audio));
    this.audioBytes += audio.length;
  }

  onTranscript(callback) {
    if (typeof callback === "function") this.transcriptCallbacks.add(callback);
  }

  offTranscript(callback) {
    this.transcriptCallbacks.delete(callback);
  }

  onError(callback) {
    if (typeof callback === "function") this.errorCallbacks.add(callback);
  }

  offError(callback) {
    this.errorCallbacks.delete(callback);
  }

  finalize() {
    if (!this.connected || this.closed || this.audioBytes === 0) return;
    const pcm = Buffer.concat(this.audioChunks, this.audioBytes);
    this.audioChunks = [];
    this.audioBytes = 0;
    this.flushTail = this.flushTail
      .then(() => this.transcribeFinal(pcm))
      .catch((error) => this.emitError(error instanceof Error ? error : new Error(String(error))));
  }

  close() {
    this.connected = false;
    this.closed = true;
    this.audioChunks = [];
    this.audioBytes = 0;
  }

  async transcribeFinal(pcm) {
    const wav = pcm16MonoToWav(pcm, this.sampleRate);
    const form = new FormData();
    form.append("file", new Blob([wav], { type: "audio/wav" }), "utterance.wav");
    form.append("model", this.model);
    if (this.language) form.append("language", this.language);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("local_stt_timeout")), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/v1/audio/transcriptions`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (!response?.ok) {
        const detail = await response?.text?.().catch(() => "") ?? "";
        throw new Error(`local_stt_http_${response?.status ?? "unknown"}:${detail.slice(0, 240)}`);
      }
      const raw = await response.text();
      let text = "";
      try {
        const parsed = JSON.parse(raw);
        text = String(parsed?.text ?? "").trim();
      } catch {
        text = raw.trim();
      }
      if (!text) return;
      const transcript = {
        text,
        isFinal: true,
        confidence: 0,
        speechFinal: true,
        eventType: "Results",
      };
      for (const callback of this.transcriptCallbacks) {
        Promise.resolve(callback(transcript)).catch((error) =>
          this.emitError(error instanceof Error ? error : new Error(String(error))),
        );
      }
    } catch (error) {
      if (controller.signal.aborted) throw new Error("local_stt_timeout");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  emitError(error) {
    for (const callback of this.errorCallbacks) {
      try {
        callback(error);
      } catch {
        // Provider error callbacks are observational; never recursively fail the worker.
      }
    }
  }
}
