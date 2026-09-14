import type { SentimentVerdict } from "../../agent-engine/agent/sentiment";
import type { AgentConversationStyle } from "../../agent-engine/contracts/agent-os";

export type VoiceAffect = "neutral" | "calm" | "warm" | "empathetic" | "upbeat" | "firm";
export type VoicePace = "slow" | "normal" | "fast";
export type VoiceTone = "neutral" | "warm" | "serious" | "bright";

export interface VoiceDeliveryStyle {
  affect: VoiceAffect;
  pace: VoicePace;
  energy: number;
  tone: VoiceTone;
}

export interface ResolveVoiceDeliveryStyleInput {
  sentiment: SentimentVerdict;
  conversationStyle?: AgentConversationStyle;
}

function roundEnergy(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

export function resolveVoiceDeliveryStyle(input: ResolveVoiceDeliveryStyleInput): VoiceDeliveryStyle {
  const register = input.conversationStyle?.register ?? "professional";

  if (input.sentiment.label === "negative") {
    if (register === "warm" || register === "casual") {
      return { affect: "empathetic", pace: "slow", energy: 0.35, tone: "warm" };
    }
    return { affect: "calm", pace: "slow", energy: 0.3, tone: "serious" };
  }

  if (input.sentiment.label === "positive") {
    if (register === "casual") {
      return { affect: "upbeat", pace: "normal", energy: 0.7, tone: "bright" };
    }
    if (register === "warm") {
      return { affect: "warm", pace: "normal", energy: 0.6, tone: "warm" };
    }
    return { affect: "warm", pace: "normal", energy: 0.55, tone: "neutral" };
  }

  if (register === "warm") {
    return { affect: "warm", pace: "normal", energy: 0.5, tone: "warm" };
  }
  if (register === "casual") {
    return { affect: "warm", pace: "normal", energy: 0.55, tone: "bright" };
  }

  return { affect: "neutral", pace: "normal", energy: roundEnergy(0.45), tone: "neutral" };
}
