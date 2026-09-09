import { describe, expect, it } from "vitest";
import { createVoiceActivitySegmenter, payloadRms } from "./voice-activity.mjs";

const speech = Buffer.alloc(160, 0x02);
const silence = Buffer.alloc(160, 0xff);

describe("voice activity segmenter", () => {
  it("classifies mu-law speech and silence without a model", () => {
    expect(payloadRms(speech)).toBeGreaterThan(180);
    expect(payloadRms(silence)).toBe(0);
  });

  it("ends a segment only after trailing silence, preserving pre-roll", () => {
    const vad = createVoiceActivitySegmenter({ frameMs: 20, minSpeechMs: 100, endSilenceMs: 100, preRollMs: 40 });
    for (let i = 0; i < 2; i += 1) expect(vad.push(silence)).toBeNull();
    for (let i = 0; i < 6; i += 1) expect(vad.push(speech)).toBeNull();
    for (let i = 0; i < 5; i += 1) {
      const result = vad.push(silence);
      if (i < 4) expect(result).toBeNull();
      else {
        expect(result).toHaveLength(12);
        expect(result.some((frame) => frame.equals(speech))).toBe(true);
      }
    }
  });

  it("does not emit a short noise burst", () => {
    const vad = createVoiceActivitySegmenter({ frameMs: 20, minSpeechMs: 100, endSilenceMs: 100 });
    for (let i = 0; i < 2; i += 1) vad.push(speech);
    for (let i = 0; i < 8; i += 1) expect(vad.push(silence)).toBeNull();
    expect(vad.flush()).toBeNull();
  });
});
