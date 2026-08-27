import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  StreamingSttPort,
  VoiceAudioEncoding,
  VoiceAudioFrame,
  VoiceSttEvent,
} from "./stt-port";
import type { StreamingTtsPort, VoiceTtsOptions, VoiceTtsPlayback } from "./tts-port";

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
    expectTypeOf<VoiceAudioFrame>().toHaveProperty("encoding");
    expectTypeOf<VoiceAudioFrame["encoding"]>().toEqualTypeOf<VoiceAudioEncoding>();
  });

  it("requires TTS playback to expose cancellable streaming audio", () => {
    expectTypeOf<StreamingTtsPort>().toHaveProperty("synthesize");
    expectTypeOf<VoiceTtsPlayback>().toHaveProperty("audio");
    expectTypeOf<VoiceTtsPlayback>().toHaveProperty("cancel");
  });

  it("leaves voice selection optional so a caller without a VoiceProfile still gets a default (Fase 3)", () => {
    expectTypeOf<VoiceTtsOptions>().toMatchTypeOf<{ locale: string; signal: AbortSignal }>();
    const withoutVoice: VoiceTtsOptions = { locale: "pt-PT", signal: new AbortController().signal };
    expect(withoutVoice.voice).toBeUndefined();
  });
});
