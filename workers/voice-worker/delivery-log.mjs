const AFFECTS = new Set(["neutral", "calm", "warm", "empathetic", "upbeat", "firm"]);
const PACES = new Set(["slow", "normal", "fast"]);
const TONES = new Set(["neutral", "warm", "serious", "bright"]);

export function normalizeVoiceDeliveryForLog(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const affect = value.affect;
  const pace = value.pace;
  const energy = value.energy;
  const tone = value.tone;
  if (!AFFECTS.has(affect) || !PACES.has(pace) || !TONES.has(tone)) return null;
  if (typeof energy !== "number" || !Number.isFinite(energy) || energy < 0 || energy > 1) return null;
  return { affect, pace, energy, tone };
}
