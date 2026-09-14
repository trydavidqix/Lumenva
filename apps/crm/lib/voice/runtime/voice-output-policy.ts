export type VoiceOutputPolicyResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "voice_output_empty"
        | "voice_output_too_many_sentences"
        | "voice_output_unspoken_value"
        | "voice_output_turn_signal_missing";
    };

const RAW_VALUE_PATTERN = /\d|[€$£¥₽₹]/u;
const TURN_PASS_CUE = /(?:pode falar|estou ouvindo|pode dizer|diga-me|diga me|quando quiser|tell me|go ahead|i['’]?m listening|im listening)[.!]?$/iu;

function sentenceCount(text: string): number {
  const segments = text
    .split(/(?<=[.!?])\s+/u)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return Math.max(1, segments.length);
}

/**
 * Enforces VOZ-01/02/03 without rewriting business content.
 * Invalid text fails closed so a formatter can never truncate facts or invent a turn cue.
 */
export function validateVoiceOutput(input: string): VoiceOutputPolicyResult {
  const text = input.trim();
  if (!text) return { ok: false, reason: "voice_output_empty" };
  if (sentenceCount(text) > 2) return { ok: false, reason: "voice_output_too_many_sentences" };
  if (RAW_VALUE_PATTERN.test(text)) return { ok: false, reason: "voice_output_unspoken_value" };
  if (!text.endsWith("?") && !TURN_PASS_CUE.test(text)) {
    return { ok: false, reason: "voice_output_turn_signal_missing" };
  }
  return { ok: true };
}
