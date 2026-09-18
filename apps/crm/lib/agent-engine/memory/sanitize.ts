import type { SemanticMemoryRecord } from "./types";

export type MemorySanitizationResult =
  | { allowed: true; text: string }
  | { allowed: false; reason: string };

const API_KEY_ASSIGNMENT =
  /\b(?:api[_ -]?key|apikey|chave\s+(?:da|de)\s+api)\b\s*(?:é|is|=|:)\s*[^\s,;]+/iu;
const API_KEY_LIKE_VALUE =
  /\b(?:sk|rk|pk|ghp|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{12,}\b|\b(?:AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35})\b/;
const REDACTED_SECRET_FIXTURE = /\bREDACTED_SECRET\b/;
const ENV_API_KEY_ASSIGNMENT =
  /\b(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN)\s*=\s*\S+/i;
const BEARER_CREDENTIAL = /\bbearer\s+\S+/iu;
const JWT_LIKE_VALUE = /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;
const SESSION_OR_COOKIE_ASSIGNMENT =
  /\b(?:session(?:[_ -]?(?:id|token|key))?|cookie|set-cookie|authorization)\b\s*(?:=|:|é|is)\s*\S+/iu;
const PASSWORD_STATEMENT = /\b(?:password|passwd|senha|passcode)\b/iu;
const RECOVERY_CODE_STATEMENT =
  /\b(?:recovery[ -]?code|c[oó]digo\s+de\s+recupera[cç][aã]o)\b/iu;
const CVV_STATEMENT =
  /\b(?:cvv|cvc|security[ -]?code|c[oó]digo\s+de\s+seguran[cç]a)\b\s*(?:(?:=|:|é|is)\s*)?\d{3,4}\b/iu;
const INTERNAL_SECRET_VARIABLE =
  /\b(?:[A-Z][A-Z0-9]*_)*(?:API_?KEY|ACCESS_TOKEN|REFRESH_TOKEN|AUTH_TOKEN|CLIENT_SECRET|PRIVATE_KEY|DATABASE_PASSWORD|DB_PASSWORD|SESSION_TOKEN|SESSION_KEY|SECRET)\b/i;
const ENV_SECRET_ASSIGNMENT = /\b(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN)\s*=\s*\S+/i;
const TOKEN_ASSIGNMENT = /\btoken\b\s*(?:=|:|é|is)\s*\S+/iu;
const CREDENTIAL_ASSIGNMENT =
  /\b(?:token|access[_ -]?token|refresh[_ -]?token|auth(?:orization)?[_ -]?token|client[_ -]?secret|private[_ -]?key)\b\s*(?:=|:|é|is)\s*\S+/iu;
const CARD_NUMBER_CANDIDATE = /(?<!\d)(?:\d[ -]?){13,19}(?!\d)/;
// CPF (Brazilian tax id): 3-3-3-2 digit grouping, punctuated or bare. L-07
// requires CPF encrypted at rest and out of logs/dumps/screenshots — a free-text
// semantic-memory record has neither guarantee, so it's rejected the same way
// a card number is, not merely masked.
const CPF_CANDIDATE = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/;

function containsCardNumber(text: string): boolean {
  return CARD_NUMBER_CANDIDATE.test(text);
}

function containsCpf(text: string): boolean {
  return CPF_CANDIDATE.test(text);
}

/**
 * Decides locally whether a semantic-memory candidate is safe to persist.
 * Credential-like text is intentionally rejected rather than partially kept:
 * the sanitizer fails closed whenever its deterministic rules see a secret.
 */
export function sanitizeMemoryCandidate(input: {
  text: string;
  type: SemanticMemoryRecord["type"];
}): MemorySanitizationResult {
  const { text } = input;

  if (
    API_KEY_ASSIGNMENT.test(text) ||
    API_KEY_LIKE_VALUE.test(text) ||
    REDACTED_SECRET_FIXTURE.test(text) ||
    ENV_API_KEY_ASSIGNMENT.test(text)
  ) {
    return { allowed: false, reason: "api_key" };
  }
  if (ENV_SECRET_ASSIGNMENT.test(text)) {
    return { allowed: false, reason: "api_key" };
  }
  if (TOKEN_ASSIGNMENT.test(text)) {
    return { allowed: false, reason: "credential" };
  }
  if (BEARER_CREDENTIAL.test(text) || JWT_LIKE_VALUE.test(text)) {
    return { allowed: false, reason: "credential" };
  }
  if (SESSION_OR_COOKIE_ASSIGNMENT.test(text) || CREDENTIAL_ASSIGNMENT.test(text)) {
    return { allowed: false, reason: "session_or_credential" };
  }
  if (PASSWORD_STATEMENT.test(text) || RECOVERY_CODE_STATEMENT.test(text)) {
    return { allowed: false, reason: "password_or_recovery_code" };
  }
  if (CVV_STATEMENT.test(text) || containsCardNumber(text)) {
    return { allowed: false, reason: "payment_card" };
  }
  if (containsCpf(text)) {
    return { allowed: false, reason: "cpf" };
  }
  if (INTERNAL_SECRET_VARIABLE.test(text)) {
    return { allowed: false, reason: "internal_secret_variable" };
  }

  return { allowed: true, text };
}
