import type { StreamingSttPort, VoiceAudioFrame } from "../runtime/stt-port";
import type { StreamingTtsPort, VoiceTtsPlayback } from "../runtime/tts-port";

/**
 * Fala com o sidecar Python já provado numa ligação real
 * (voice_worker_server_v12.py na VPS) — modo LOTE, não streaming: 1
 * chamada HTTP por turno em cada porta. STT usa /stt (Task 2, endpoint
 * novo, isolado — sem chat nem TTS embutido); TTS usa /speak (já existia,
 * usado hoje na saudação proativa).
 */
export function createSidecarSpeechAdapter(config: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): { stt: StreamingSttPort; tts: StreamingTtsPort } {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 20_000;

  const stt: StreamingSttPort = {
    async *transcribe(frames, options) {
      const chunks: Uint8Array[] = [];
      for await (const f of frames) {
        if (options.signal.aborted) throw new Error("[voice] sidecar STT aborted");
        chunks.push(f.data);
      }
      const body = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      const response = await fetchImpl(`${baseUrl}/stt`, {
        method: "POST",
        body,
        signal: AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)]),
      });
      if (!response.ok) {
        throw new Error(`[voice] sidecar /stt failed: http_${response.status}`);
      }
      const text = (await response.text()).trim();
      yield { type: "final", text, confidence: null };
    },
  };

  const tts: StreamingTtsPort = {
    async synthesize(text, options): Promise<VoiceTtsPlayback> {
      const response = await fetchImpl(`${baseUrl}/speak`, {
        method: "POST",
        body: text,
        signal: AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)]),
      });
      if (!response.ok) {
        throw new Error(`[voice] sidecar /speak failed: http_${response.status}`);
      }
      const audioBuffer = new Uint8Array(await response.arrayBuffer());
      const singleFrame: VoiceAudioFrame = {
        data: audioBuffer,
        encoding: "mulaw",
        sampleRateHz: 8000,
        channels: 1,
        timestampMs: 0,
      };
      let cancelled = false;
      // `audio` na interface VoiceTtsPlayback é um AsyncIterable (propriedade), não um método —
      // um gerador async *invocado* na hora (não uma função nomeada) devolve o objeto iterável
      // certo. Escrever `async *audio() {}` aqui seria um bug de tipo: `playback.audio` viraria
      // uma função, e `for await (const f of playback.audio)` no chamador quebraria.
      return {
        audio: (async function* () {
          if (cancelled) return;
          yield singleFrame;
        })(),
        async cancel() {
          cancelled = true;
        },
      };
    },
  };

  return { stt, tts };
}
