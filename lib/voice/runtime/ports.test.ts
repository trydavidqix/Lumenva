import { describe, expectTypeOf, it } from "vitest";

import type {
  StreamingSttPort,
  VoiceAudioEncoding,
  VoiceAudioFrame,
  VoiceSttEvent,
} from "./stt-port";
import type { StreamingTtsPort, VoiceTtsPlayback } from "./tts-port";

describe("voice provider ports", () => {
  it("keeps STT provider neutral and streaming", () => {
    expectTypeOf<StreamingSttPort>().toHaveProperty("transcribe");
    expectTypeOf<VoiceAudioFrame>().toHaveProperty("data");
    expectTypeOf<VoiceSttEvent>().toMatchTypeOf<
      | { type: "partial"; text: string; confidence: number | null }
      | { type: "final"; text: string; confidence: number | null }
    >();
  });

  it("makes wire audio encoding explicit across transport and speech adapters", () => {
    expectTypeOf<VoiceAudioEncoding>().toEqualTypeOf<"pcm_s16le" | "opus" | "mulaw">();
    expectTypeOf<VoiceAudioFrame>().toMatchTypeOf<{
      data: Uint8Array;
      encoding: VoiceAudioEncoding;
      sampleRateHz: number;
      channels: number;
      timestampMs: number;
    }>();
  });

  it("requires TTS playback to expose cancellable streaming audio", () => {
    expectTypeOf<StreamingTtsPort>().toHaveProperty("synthesize");
    expectTypeOf<VoiceTtsPlayback>().toHaveProperty("audio");
    expectTypeOf<VoiceTtsPlayback>().toHaveProperty("cancel");
  });
});
