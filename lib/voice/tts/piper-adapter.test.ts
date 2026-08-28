import { describe, expect, it, vi } from "vitest";
import { createPiperTtsPort, type PiperClient } from "./piper-adapter";
import type { VoiceAudioFrame } from "../runtime/stt-port";

async function* frames(): AsyncIterable<VoiceAudioFrame> {
  yield { data: new Uint8Array([1]), encoding: "pcm_s16le", sampleRateHz: 16000, channels: 1, timestampMs: 0 };
}

describe("Piper TTS adapter (Fase 3)", () => {
  it("uses the default voice when the call carries no VoiceProfile", async () => {
    const synthesizeStream = vi.fn().mockReturnValue(frames());
    const port = createPiperTtsPort({ client: { synthesizeStream }, defaultVoiceId: "pt-pt-ines" });

    await port.synthesize("bom dia", { locale: "pt-PT", signal: new AbortController().signal });

    expect(synthesizeStream).toHaveBeenCalledWith(
      expect.objectContaining({ text: "bom dia", voiceId: "pt-pt-ines", locale: "pt-PT" }),
    );
  });

  it("prefers the profile's voice, tone, speed and pitch over the default", async () => {
    const synthesizeStream = vi.fn().mockReturnValue(frames());
    const port = createPiperTtsPort({ client: { synthesizeStream }, defaultVoiceId: "pt-pt-ines" });

    await port.synthesize("bom dia", {
      locale: "pt-PT",
      signal: new AbortController().signal,
      voice: { voiceId: "pt-pt-tiago", tone: "professional", speed: 1.1, pitch: -2 },
    });

    expect(synthesizeStream).toHaveBeenCalledWith(
      expect.objectContaining({ voiceId: "pt-pt-tiago", tone: "professional", speed: 1.1, pitch: -2 }),
    );
  });

  it("rejects empty text before touching the client", async () => {
    const client: PiperClient = { synthesizeStream: vi.fn() };
    const port = createPiperTtsPort({ client, defaultVoiceId: "pt-pt-ines" });

    await expect(port.synthesize("   ", { locale: "pt-PT", signal: new AbortController().signal })).rejects.toThrow(
      /empty text/,
    );
    expect(client.synthesizeStream).not.toHaveBeenCalled();
  });

  it("cancel() aborts the underlying stream for barge-in", async () => {
    let capturedSignal: AbortSignal | undefined;
    const synthesizeStream = vi.fn((input: { signal: AbortSignal }) => {
      capturedSignal = input.signal;
      return frames();
    });
    const port = createPiperTtsPort({ client: { synthesizeStream }, defaultVoiceId: "pt-pt-ines" });

    const playback = await port.synthesize("bom dia", { locale: "pt-PT", signal: new AbortController().signal });
    expect(capturedSignal?.aborted).toBe(false);
    await playback.cancel();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("fails closed when constructed with no default voice", () => {
    expect(() => createPiperTtsPort({ client: { synthesizeStream: vi.fn() }, defaultVoiceId: "  " })).toThrow(
      /requires a defaultVoiceId/,
    );
  });

  it("rejects an invalid locale before touching the provider", async () => {
    const client: PiperClient = { synthesizeStream: vi.fn() };
    const port = createPiperTtsPort({ client, defaultVoiceId: "pt-pt-ines" });
    await expect(port.synthesize("oi", { locale: "not a locale", signal: new AbortController().signal })).rejects.toThrow(/invalid locale/i);
    expect(client.synthesizeStream).not.toHaveBeenCalled();
  });

  it("cancels a stalled first audio frame after the configured timeout", async () => {
    let providerSignal: AbortSignal | undefined;
    const port = createPiperTtsPort({
      defaultVoiceId: "pt-pt-ines",
      timeoutMs: 10,
      client: { synthesizeStream: vi.fn((input) => { providerSignal = input.signal; return (async function* () { await new Promise(() => {}); })(); }) },
    });
    const playback = await port.synthesize("oi", { locale: "pt-PT", signal: new AbortController().signal });
    await expect(playback.audio[Symbol.asyncIterator]().next()).rejects.toThrow(/timed out/i);
    expect(providerSignal?.aborted).toBe(true);
  });
});
