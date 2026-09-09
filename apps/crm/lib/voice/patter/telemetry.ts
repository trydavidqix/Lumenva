export interface PatterMetricSnapshot {
  carrierMs?: number;
  sttMs?: number;
  agentMs?: number;
  ttsMs?: number;
  e2eMs?: number;
  interruptionMs?: number;
  carrierCostCents?: number;
  sttCostCents?: number;
  ttsCostCents?: number;
}

export interface VoiceMetricSnapshot {
  carrier_ms?: number;
  stt_ms?: number;
  agent_ms?: number;
  tts_ms?: number;
  e2e_ms?: number;
  interruption_ms?: number;
  carrier_cost_cents?: number;
  stt_cost_cents?: number;
  tts_cost_cents?: number;
  total_voice_cost_cents: number;
}

function finiteNonNegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function normalizePatterMetrics(input: PatterMetricSnapshot): VoiceMetricSnapshot {
  const carrierCost = finiteNonNegative(input.carrierCostCents);
  const sttCost = finiteNonNegative(input.sttCostCents);
  const ttsCost = finiteNonNegative(input.ttsCostCents);

  return {
    ...(finiteNonNegative(input.carrierMs) !== undefined ? { carrier_ms: input.carrierMs } : {}),
    ...(finiteNonNegative(input.sttMs) !== undefined ? { stt_ms: input.sttMs } : {}),
    ...(finiteNonNegative(input.agentMs) !== undefined ? { agent_ms: input.agentMs } : {}),
    ...(finiteNonNegative(input.ttsMs) !== undefined ? { tts_ms: input.ttsMs } : {}),
    ...(finiteNonNegative(input.e2eMs) !== undefined ? { e2e_ms: input.e2eMs } : {}),
    ...(finiteNonNegative(input.interruptionMs) !== undefined
      ? { interruption_ms: input.interruptionMs }
      : {}),
    ...(carrierCost !== undefined ? { carrier_cost_cents: carrierCost } : {}),
    ...(sttCost !== undefined ? { stt_cost_cents: sttCost } : {}),
    ...(ttsCost !== undefined ? { tts_cost_cents: ttsCost } : {}),
    total_voice_cost_cents: (carrierCost ?? 0) + (sttCost ?? 0) + (ttsCost ?? 0),
  };
}

const E164 = /^\+[1-9]\d{6,14}$/;

function redact(value: unknown): unknown {
  if (typeof value !== "string" || !E164.test(value)) return value;
  return `***${value.slice(-4)}`;
}

export function redactVoiceLogFields<T extends Record<string, unknown>>(fields: T): T {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, redact(value)])) as T;
}
