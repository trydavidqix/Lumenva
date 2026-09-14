const CANNED_OPENERS = [
  /^\s*ótima pergunta!\s*/i,
  /^\s*excelente pergunta!\s*/i,
  /^\s*boa pergunta!\s*/i,
] as const;

export function prepareSpeakableVoiceText(input: string): string {
  let text = input.trim();
  for (const opener of CANNED_OPENERS) text = text.replace(opener, "");

  // Remove only presentation markup that has no spoken meaning. Do not
  // normalize numbers/dates/currency or truncate sentences here: those
  // operations can change factual content and need separate, provider-aware proof.
  text = text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}
