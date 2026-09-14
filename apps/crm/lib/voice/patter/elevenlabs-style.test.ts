import { describe, expect, it } from "vitest";

import { toElevenLabsDeliverySettings } from "./elevenlabs-style";

describe("toElevenLabsDeliverySettings", () => {
  it("maps calm delivery to stable low-style speech", () => {
    expect(toElevenLabsDeliverySettings({ affect: "calm", pace: "slow", energy: 0.3, tone: "serious" }))
      .toEqual({ stability: 0.82, similarity_boost: 0.78, style: 0.12, use_speaker_boost: false });
  });

  it("maps empathetic delivery to stable restrained expression", () => {
    const settings = toElevenLabsDeliverySettings({ affect: "empathetic", pace: "slow", energy: 0.35, tone: "warm" });
    expect(settings.stability).toBeGreaterThanOrEqual(0.7);
    expect(settings.style).toBeLessThanOrEqual(0.35);
  });

  it("maps upbeat delivery to bounded expression", () => {
    const settings = toElevenLabsDeliverySettings({ affect: "upbeat", pace: "normal", energy: 0.7, tone: "bright" });
    expect(settings.style).toBeGreaterThan(0.4);
    expect(settings.style).toBeLessThanOrEqual(0.7);
  });

  it("never emits provider values outside 0..1", () => {
    const settings = toElevenLabsDeliverySettings({ affect: "firm", pace: "normal", energy: 1, tone: "serious" });
    for (const value of [settings.stability, settings.similarity_boost, settings.style]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});
