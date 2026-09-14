import type { VoiceDeliveryStyle } from "../runtime/delivery-style";

export interface ElevenLabsDeliverySettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

function clamp01(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

export function toElevenLabsDeliverySettings(delivery: VoiceDeliveryStyle): ElevenLabsDeliverySettings {
  const presets: Record<VoiceDeliveryStyle["affect"], ElevenLabsDeliverySettings> = {
    neutral: { stability: 0.72, similarity_boost: 0.78, style: 0.22, use_speaker_boost: false },
    calm: { stability: 0.82, similarity_boost: 0.78, style: 0.12, use_speaker_boost: false },
    warm: { stability: 0.68, similarity_boost: 0.8, style: 0.34, use_speaker_boost: false },
    empathetic: { stability: 0.76, similarity_boost: 0.8, style: 0.26, use_speaker_boost: false },
    upbeat: { stability: 0.58, similarity_boost: 0.78, style: 0.58, use_speaker_boost: false },
    firm: { stability: 0.86, similarity_boost: 0.8, style: 0.1, use_speaker_boost: false },
  };
  const base = presets[delivery.affect];
  const energyAdjustment = (delivery.energy - 0.5) * 0.2;
  return {
    stability: clamp01(base.stability - Math.max(0, energyAdjustment) * 0.25),
    similarity_boost: clamp01(base.similarity_boost),
    style: clamp01(base.style + energyAdjustment),
    use_speaker_boost: base.use_speaker_boost,
  };
}
