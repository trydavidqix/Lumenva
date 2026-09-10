/** Deterministic, provider-free sentiment workflow for Agent OS local decisions. */

export type SentimentLabel = "negative" | "neutral" | "positive";

export interface SentimentVerdict {
  label: SentimentLabel;
  score: number;
  signals: string[];
}

const NEGATIVE_SIGNALS = [
  "cancelar",
  "cancelamento",
  "chargeback",
  "reclamação",
  "reclamar",
  "problema",
  "péssimo",
  "pessimo",
  "frustrado",
  "frustração",
  "atraso",
  "erro",
  "insatisfeito",
  "insatisfação",
  "não funciona",
  "nao funciona",
] as const;

const POSITIVE_SIGNALS = [
  "obrigado",
  "obrigada",
  "parabéns",
  "parabens",
  "excelente",
  "ótimo",
  "otimo",
  "perfeito",
  "gostei",
  "satisfeito",
  "satisfação",
  "recomendo",
  "funcionou",
] as const;

function normalize(text: string): string {
  return text.trim().toLocaleLowerCase("pt-BR");
}

export function classifySentiment(text: string): SentimentVerdict {
  const normalized = normalize(text);
  const signals = [...NEGATIVE_SIGNALS, ...POSITIVE_SIGNALS].filter((signal) => normalized.includes(signal));
  const negativeCount = NEGATIVE_SIGNALS.filter((signal) => normalized.includes(signal)).length;
  const positiveCount = POSITIVE_SIGNALS.filter((signal) => normalized.includes(signal)).length;
  const score = Math.round(Math.max(0, Math.min(1, 0.5 + (positiveCount - negativeCount) * 0.2)) * 100) / 100;
  const label: SentimentLabel = score < 0.4 ? "negative" : score > 0.6 ? "positive" : "neutral";
  return { label, score, signals };
}
