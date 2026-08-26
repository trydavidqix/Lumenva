import { describe, expect, it } from "vitest";

import {
  createVoiceSessionState,
  reduceVoiceSession,
  requiresCriticalFieldConfirmation,
  VoiceLatencyTracker,
} from "./session";

describe("voice realtime session", () => {
  it("moves through listening, processing and speaking without provider knowledge", () => {
    let state = createVoiceSessionState();
    state = reduceVoiceSession(state, { type: "customer_speech_started", atMs: 100 });
    expect(state.phase).toBe("listening");
    state = reduceVoiceSession(state, { type: "final_transcript", text: "olá", confidence: 0.98, atMs: 500 });
    expect(state.phase).toBe("processing");
    state = reduceVoiceSession(state, { type: "tts_started", atMs: 900 });
    expect(state.phase).toBe("speaking");
  });

  it("fails closed on impossible transitions after the session ended", () => {
    const ended = reduceVoiceSession(createVoiceSessionState(), { type: "end", reason: "completed", atMs: 10 });
    expect(() => reduceVoiceSession(ended, { type: "tts_started", atMs: 20 })).toThrow(/invalid voice session transition/i);
  });

  it("does not process transcripts while the call is held", () => {
    let state = reduceVoiceSession(createVoiceSessionState(), { type: "customer_speech_started", atMs: 100 });
    state = reduceVoiceSession(state, { type: "hold", atMs: 200 });
    expect(() =>
      reduceVoiceSession(state, { type: "final_transcript", text: "ignorar", confidence: 0.99, atMs: 300 }),
    ).toThrow(/invalid voice session transition/i);
  });

  it("ends safely after configured silence timeout", () => {
    const state = reduceVoiceSession(createVoiceSessionState(), { type: "silence_timeout", atMs: 20_000 });
    expect(state.phase).toBe("ended");
    expect(state.endReason).toBe("silence_timeout");
  });

  it("requires confirmation for low-confidence critical spoken fields", () => {
    for (const field of ["phone", "address", "amount", "date"] as const) {
      expect(requiresCriticalFieldConfirmation(field, 0.79)).toBe(true);
      expect(requiresCriticalFieldConfirmation(field, 0.97)).toBe(false);
    }
    expect(requiresCriticalFieldConfirmation("general", 0.2)).toBe(false);
  });

  it("measures STT, model, TTS and end-to-end latencies independently", () => {
    const tracker = new VoiceLatencyTracker(1000);
    tracker.markSttFinal(1250);
    tracker.markModelFirstToken(1600);
    tracker.markTtsFirstAudio(1750);
    tracker.markTurnComplete(2100);
    expect(tracker.snapshot()).toEqual({
      sttFinalMs: 250,
      modelFirstTokenMs: 600,
      ttsFirstAudioMs: 750,
      endToEndMs: 1100,
    });
  });
});
