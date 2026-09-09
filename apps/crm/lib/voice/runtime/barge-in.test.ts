import { describe, expect, it, vi } from "vitest";

import { handleBargeIn } from "./barge-in";

describe("voice barge-in", () => {
  it("cancels current TTS before returning to listening", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const next = await handleBargeIn({
      phase: "speaking",
      endReason: null,
      lastTranscript: null,
      lastTranscriptConfidence: null,
    }, { cancel });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(next.phase).toBe("listening");
  });

  it("does nothing when the system is not speaking", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const state = {
      phase: "listening" as const,
      endReason: null,
      lastTranscript: null,
      lastTranscriptConfidence: null,
    };
    expect(await handleBargeIn(state, { cancel })).toEqual(state);
    expect(cancel).not.toHaveBeenCalled();
  });
});
