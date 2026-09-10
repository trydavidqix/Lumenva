import { describe, expect, it } from "vitest";

import { transitionVoicePipeline, type VoicePipelineSnapshot } from "./contracts";

const initial: VoicePipelineSnapshot = { stage: "idle", lastEventAt: null };

describe("provider-free voice pipeline contract", () => {
  it("models the neutral audio → transcript → response lifecycle", () => {
    let state = transitionVoicePipeline(initial, { type: "session_started", at: "t1" });
    state = transitionVoicePipeline(state, { type: "audio_received", at: "t2", sequence: 1 });
    state = transitionVoicePipeline(state, { type: "transcript_ready", at: "t3", text: "olá" });
    state = transitionVoicePipeline(state, { type: "response_ready", at: "t4", text: "bom dia" });
    expect(state).toEqual({ stage: "speaking", lastEventAt: "t4" });
  });

  it("preserves terminal failure and records a retry-safe code", () => {
    const failed = transitionVoicePipeline(
      { stage: "processing", lastEventAt: "t1" },
      { type: "pipeline_failed", at: "t2", code: "turn_timeout", retryable: true },
    );
    expect(failed).toEqual({ stage: "failed", lastEventAt: "t2", lastErrorCode: "turn_timeout" });
    expect(transitionVoicePipeline(failed, { type: "session_started", at: "t3" })).toBe(failed);
  });

  it("does not select a telephony or media provider", () => {
    const neutralEvent = { type: "session_started" as const, at: "t1" };
    expect(transitionVoicePipeline(initial, neutralEvent).stage).toBe("listening");
  });
});
