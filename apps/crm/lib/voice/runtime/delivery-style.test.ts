import { describe, expect, it } from "vitest";

import type { AgentConversationStyle } from "../../agent-engine/product-agents/conversation-style";
import { resolveVoiceDeliveryStyle } from "./delivery-style";

const style = (register: AgentConversationStyle["register"]): AgentConversationStyle => ({
  register,
  toneInstructions: "test style",
});

describe("resolveVoiceDeliveryStyle", () => {
  it("makes a negative warm turn empathetic and slow", () => {
    const result = resolveVoiceDeliveryStyle({
      sentiment: { label: "negative", score: 0.2, signals: ["problema"] },
      conversationStyle: style("warm"),
    });
    expect(result).toEqual({ affect: "empathetic", pace: "slow", energy: 0.35, tone: "warm" });
  });

  it("keeps negative professional delivery calm and serious", () => {
    const result = resolveVoiceDeliveryStyle({
      sentiment: { label: "negative", score: 0.2, signals: ["reclamação"] },
      conversationStyle: style("professional"),
    });
    expect(result).toEqual({ affect: "calm", pace: "slow", energy: 0.3, tone: "serious" });
  });

  it("allows positive casual delivery to be upbeat without maxing energy", () => {
    const result = resolveVoiceDeliveryStyle({
      sentiment: { label: "positive", score: 0.9, signals: ["perfeito"] },
      conversationStyle: style("casual"),
    });
    expect(result.affect).toBe("upbeat");
    expect(result.pace).toBe("normal");
    expect(result.tone).toBe("bright");
    expect(result.energy).toBeLessThanOrEqual(0.75);
  });

  it("does not let professional personality become hyper-upbeat", () => {
    const result = resolveVoiceDeliveryStyle({
      sentiment: { label: "positive", score: 0.9, signals: ["excelente"] },
      conversationStyle: style("professional"),
    });
    expect(result.affect).not.toBe("upbeat");
    expect(result.energy).toBeLessThanOrEqual(0.55);
  });

  it("uses a professional safe default when style is absent", () => {
    const result = resolveVoiceDeliveryStyle({
      sentiment: { label: "neutral", score: 0.5, signals: [] },
    });
    expect(result).toEqual({ affect: "neutral", pace: "normal", energy: 0.45, tone: "neutral" });
  });
});
