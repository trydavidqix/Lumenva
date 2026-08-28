import { describe, expect, it, vi } from "vitest";
import { createKokoroTtsPort, type KokoroClient } from "./kokoro-adapter";
import type { VoiceAudioFrame } from "../runtime/stt-port";

async function* frames(): AsyncIterable<VoiceAudioFrame> {
  yield { data: new Uint8Array([1]), encoding: "pcm_s16le", sampleRateHz: 24000, channels: 1, timestampMs: 0 };
}

describe("Kokoro TTS adapter (Fase 3)", () => {
  it("uses the default voice when the call carries no VoiceProfile", async () => {
    const synthesizeStream = vi.fn().mockReturnValue(frames());
    const port = createKokoroTtsPort({ client: { synthesizeStream }, defaultVoiceId: "pt-pt-beatriz" });

    await port.synthesize("bom dia", { locale: "pt-PT", signal: new AbortController().signal });

    expect(synthesizeStream).toHaveBeenCalledWith(
      expect.objectContaining({ text: "bom dia", voiceId: "pt-pt-beatriz", locale: "pt-PT" }),
    );
  });

  it("forwards the profile's tone and style along with voice/speed/pitch", async () => {
    const synthesizeStream = vi.fn().mockReturnValue(frames());
    const port = createKokoroTtsPort({ client: { synthesizeStream }, defaultVoiceId: "pt-pt-beatriz" });

    await port.synthesize("bom dia", {
      locale: "pt-PT",
      signal: new AbortController().signal,
      voice: { voiceId: "pt-pt-marta", tone: "warm", style: "conversational", speed: 0.95 },
    });

    expect(synthesizeStream).toHaveBeenCalledWith(
      expect.objectContaining({ voiceId: "pt-pt-marta", tone: "warm", style: "conversational", speed: 0.95 }),
    );
  });

  it("rejects empty text before touching the client", async () => {
    const client: KokoroClient = { synthesizeStream: vi.fn() };
    const port = createKokoroTtsPort({ client, defaultVoiceId: "pt-pt-beatriz" });

    await expect(port.synthesize("", { locale: "pt-PT", signal: new AbortController().signal })).rejects.toThrow(
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
    const port = createKokoroTtsPort({ client: { synthesizeStream }, defaultVoiceId: "pt-pt-beatriz" });

    const playback = await port.synthesize("bom dia", { locale: "pt-PT", signal: new AbortController().signal });
    await playback.cancel();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it("fails closed when constructed with no default voice", () => {
    expect(() => createKokoroTtsPort({ client: { synthesizeStream: vi.fn() }, defaultVoiceId: "" })).toThrow(
      /requires a defaultVoiceId/,
    );
  });

  it("rejects an invalid locale before touching the provider", async () => {
    const client: KokoroClient = { synthesizeStream: vi.fn() };
    const port = createKokoroTtsPort({ client, defaultVoiceId: "pt-pt-beatriz" });
    await expect(port.synthesize("oi", { locale: "not a locale", signal: new AbortController().signal })).rejects.toThrow(/invalid locale/i);
    expect(client.synthesizeStream).not.toHaveBeenCalled();
  });
});
