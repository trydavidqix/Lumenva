const MAX_LEARNING_SUMMARY_LENGTH = 500;

const SECRET_PATTERNS: readonly RegExp[] = [
  /\bAuthorization\s*:\s*Bearer\s+[^\s,;]+/gi,
  /\bBearer\s+[^\s,;]+/gi,
  /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi,
];

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_PATTERN = /(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)/g;

export function sanitizeLearningSummary(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let sanitized = trimmed;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
  }
  sanitized = sanitized
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(PHONE_PATTERN, '[REDACTED_PHONE]')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return null;
  return sanitized.slice(0, MAX_LEARNING_SUMMARY_LENGTH);
}
