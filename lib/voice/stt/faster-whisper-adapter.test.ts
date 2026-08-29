import { describe, expect, it, vi } from "vitest";
import { createFasterWhisperSttPort, type FasterWhisperClient } from "./faster-whisper-adapter";
import type { VoiceAudioFrame } from "../runtime/stt-port";

async function* noFrames(): AsyncIterable<VoiceAudioFrame> {}

function clientYielding(chunks: Array<{ text: string; confidence: number | null; isFinal: boolean }>): FasterWhisperClient {
  return {
    streamTranscribe: vi.fn(async function* () {
      for (const chunk of chunks) yield chunk;
    }),
  };
}

describe("faster-whisper STT adapter (Fase 3)", () => {
  it("maps final/partial chunks into the provider-neutral STT events", async () => {
    const client = clientYielding([
      { text: "olá", confidence: 0.4, isFinal: false },
      { text: "olá, bom dia", confidence: 0.91, isFinal: true },
    ]);
    const port = createFasterWhisperSttPort({ client, supportedLocales: ["pt-PT"] });

    const received: unknown[] = [];
    for await (const event of port.transcribe(noFrames(), { locale: "pt-PT", signal: new AbortController().signal })) {
      received.push(event);
    }

    expect(received).toEqual([
      { type: "partial", text: "olá", confidence: 0.4 },
      { type: "final", text: "olá, bom dia", confidence: 0.91 },
    ]);
  });

  it("rejects an empty final transcript instead of inventing a turn", async () => {
    const client = clientYielding([
      { text: "  ", confidence: 0.9, isFinal: true },
      { text: "agora sim", confidence: 0.88, isFinal: true },
    ]);
    const port = createFasterWhisperSttPort({ client, supportedLocales: ["pt-PT"] });

    const received: unknown[] = [];
    for await (const event of port.transcribe(noFrames(), { locale: "pt-PT", signal: new AbortController().signal })) {
      received.push(event);
    }

    expect(received).toEqual([{ type: "final", text: "agora sim", confidence: 0.88 }]);
  });

  it("rejects a call locale not supported by this deployment before touching the client", async () => {
    const client: FasterWhisperClient = { streamTranscribe: vi.fn() };
    const port = createFasterWhisperSttPort({ client, supportedLocales: ["en", "pt-PT"] });

    await expect(async () => {
      for await (const _ of port.transcribe(noFrames(), { locale: "de", signal: new AbortController().signal })) {
        // never reached
      }
    }).rejects.toThrow(/does not support locale/i);
    expect(client.streamTranscribe).not.toHaveBeenCalled();
  });

  it("fails closed when constructed with no supported locales", () => {
    expect(() => createFasterWhisperSttPort({ client: { streamTranscribe: vi.fn() }, supportedLocales: [] })).toThrow(
      /at least one supported locale/,
    );
  });

  it("aborts a stalled provider after the configured timeout", async () => {
    let providerSignal: AbortSignal | undefined;
    const client: FasterWhisperClient = {
      streamTranscribe: vi.fn((input) => {
        providerSignal = input.signal;
        return (async function* () {
          await new Promise(() => {});
        })();
      }),
    };
    const port = createFasterWhisperSttPort({ client, supportedLocales: ["pt-PT"], timeoutMs: 10 });

    await expect(async () => {
      for await (const _ of port.transcribe(noFrames(), { locale: "pt-PT", signal: new AbortController().signal })) {}
    }).rejects.toThrow(/timed out/i);
    expect(providerSignal?.aborted).toBe(true);
  });

  it("rejects malformed locales before touching the provider", async () => {
    const client: FasterWhisperClient = { streamTranscribe: vi.fn() };
    const port = createFasterWhisperSttPort({ client, supportedLocales: ["pt-PT"] });
    await expect(async () => {
      for await (const _ of port.transcribe(noFrames(), { locale: "not a locale", signal: new AbortController().signal })) {}
    }).rejects.toThrow(/invalid locale/i);
    expect(client.streamTranscribe).not.toHaveBeenCalled();
  });
});
