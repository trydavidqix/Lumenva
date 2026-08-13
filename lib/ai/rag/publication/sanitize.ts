/**
 * Deterministic secret/PII scanner for Obsidian notes headed for the CRM
 * knowledge base.
 *
 * Runs before export (Task 3's exporter) so a leaked credential or an
 * undisclosed personal contact detail never reaches the AI-retrievable
 * knowledge index. Detection is regex-based and line-scoped on purpose:
 * it has to be reproducible in CI and must never call an LLM to decide
 * whether content is safe to publish.
 *
 * Findings never carry the matched value — only a `code` and a `line` —
 * so a blocked scan result cannot itself become the leak.
 */

export interface KnowledgeScanFinding {
  code: string;
  line: number;
}

export interface KnowledgeScanResult {
  allowed: boolean;
  findings: KnowledgeScanFinding[];
}

const PRIVATE_KEY_HEADER =
  /-----BEGIN\s+(?:RSA |EC |DSA |OPENSSH |ENCRYPTED |PGP )?PRIVATE KEY-----/;

// Two separator shapes on purpose: an explicit `:`/`=` is an unambiguous
// assignment signal on its own, but "é"/"is" are ordinary Portuguese/English
// words — "a chave da API é armazenada..." or "this session is temporary"
// use them without stating a secret. So the "é"/"is" branch additionally
// requires the following token to look credential-shaped (see
// looksCredentialShaped), while the strict `:`/`=` branch does not.
const API_KEY_STRICT_ASSIGNMENT =
  /\b(?:api[_ -]?key|apikey|chave\s+(?:da|de)\s+api)\b\s*(?:=|:)\s*\S+/iu;
const API_KEY_NATURAL_ASSIGNMENT =
  /\b(?:api[_ -]?key|apikey|chave\s+(?:da|de)\s+api)\b(?:\s+[A-Za-zÀ-ÿ]+){0,4}\s*(?:é|is)\s+(\S+)/iu;
const API_KEY_LIKE_VALUE =
  /\b(?:sk|rk|pk|ghp|gho|ghu|ghs|ghr|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{10,}\b|\b(?:AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35})\b/;

const BEARER_TOKEN = /\bbearer\s+\S+/iu;
const JWT_LIKE_VALUE = /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;

// No natural-language ("é"/"is") branch here: none of this category's
// legitimate fixtures need it, and "this session is temporary" is exactly
// the ordinary-prose sentence shape that branch would misfire on.
const SESSION_OR_COOKIE_ASSIGNMENT =
  /\b(?:set-cookie|cookie|session(?:[_ -]?(?:id|token|key))?)\b\s*(?:=|:)\s*\S+/iu;

// Assignment-shaped on purpose (keyword ... separator ... value), not a bare
// keyword ban: a support knowledge base legitimately contains prose like
// "como redefinir sua senha", and a blanket ban on the word would make that
// unpublishable. A handful of words are allowed between the keyword and the
// separator to cover phrasing like "a senha do administrador é ...". See
// API_KEY above for why the "é"/"is" branch additionally validates the value.
const PASSWORD_STRICT_ASSIGNMENT =
  /\b(?:password|passwd|senha|passcode)\b\s*(?:=|:)\s*\S+/iu;
const PASSWORD_NATURAL_ASSIGNMENT =
  /\b(?:password|passwd|senha|passcode)\b(?:\s+[A-Za-zÀ-ÿ]+){0,4}\s*(?:é|is)\s+(\S+)/iu;
const RECOVERY_CODE_STRICT_ASSIGNMENT =
  /\b(?:recovery[ -]?code|backup[ -]?code|c[oó]digo\s+de\s+recupera[cç][aã]o)\b\s*(?:=|:)\s*\S+/iu;
const RECOVERY_CODE_NATURAL_ASSIGNMENT =
  /\b(?:recovery[ -]?code|backup[ -]?code|c[oó]digo\s+de\s+recupera[cç][aã]o)\b(?:\s+[A-Za-zÀ-ÿ]+){0,4}\s*(?:é|is)\s+(\S+)/iu;

const ENV_ASSIGNMENT_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\S+/;
const ENV_SECRET_KEY_HINT =
  /API_?KEY|ACCESS_TOKEN|REFRESH_TOKEN|AUTH_TOKEN|CLIENT_SECRET|PRIVATE_KEY|DATABASE_PASSWORD|DB_PASSWORD|SESSION_TOKEN|SESSION_KEY|SECRET|PASSWORD|CREDENTIAL|TOKEN/i;

const EMAIL_CANDIDATE = /\b[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_CANDIDATE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,3}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}\b/;

const CONTACT_DIRECTORY_MARKER =
  /<!--\s*knowledge-content-type\s*:\s*contact-directory\s*-->/i;

// The "é"/"is" natural-language branches only fire when the captured token
// itself looks like a credential (has a digit, or is quoted/backtick-wrapped)
// rather than an ordinary word like "armazenada" or "temporary".
function looksCredentialShaped(value: string): boolean {
  if (/^[`"'].+[`"']$/.test(value)) {
    return true;
  }
  return /\d/.test(value);
}

function matchesNaturalAssignment(pattern: RegExp, line: string): boolean {
  const match = pattern.exec(line);
  const value = match?.[1];
  return value !== undefined && looksCredentialShaped(value);
}

function scanLine(line: string): string | null {
  if (PRIVATE_KEY_HEADER.test(line)) {
    return "private_key";
  }
  if (
    API_KEY_STRICT_ASSIGNMENT.test(line) ||
    API_KEY_LIKE_VALUE.test(line) ||
    matchesNaturalAssignment(API_KEY_NATURAL_ASSIGNMENT, line)
  ) {
    return "api_key";
  }
  if (BEARER_TOKEN.test(line) || JWT_LIKE_VALUE.test(line)) {
    return "credential";
  }
  if (SESSION_OR_COOKIE_ASSIGNMENT.test(line)) {
    return "session_or_cookie";
  }
  if (
    PASSWORD_STRICT_ASSIGNMENT.test(line) ||
    RECOVERY_CODE_STRICT_ASSIGNMENT.test(line) ||
    matchesNaturalAssignment(PASSWORD_NATURAL_ASSIGNMENT, line) ||
    matchesNaturalAssignment(RECOVERY_CODE_NATURAL_ASSIGNMENT, line)
  ) {
    return "password_or_recovery_code";
  }

  const envMatch = ENV_ASSIGNMENT_LINE.exec(line);
  const envKey = envMatch?.[1];
  if (envKey && ENV_SECRET_KEY_HINT.test(envKey)) {
    return "env_secret";
  }

  return null;
}

/**
 * Scans a publishable Obsidian Markdown document (frontmatter included) for
 * secrets and undisclosed personal contact details before it is allowed to
 * reach the knowledge export pipeline.
 */
export function scanPublishableKnowledge(markdown: string): KnowledgeScanResult {
  const allowContactDirectory = CONTACT_DIRECTORY_MARKER.test(markdown);
  const findings: KnowledgeScanFinding[] = [];
  const lines = markdown.split(/\r\n|\r|\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const secretCode = scanLine(line);
    if (secretCode) {
      findings.push({ code: secretCode, line: lineNumber });
      return;
    }

    if (allowContactDirectory) {
      return;
    }

    if (EMAIL_CANDIDATE.test(line)) {
      findings.push({ code: "personal_email", line: lineNumber });
      return;
    }
    if (PHONE_CANDIDATE.test(line)) {
      findings.push({ code: "personal_phone", line: lineNumber });
    }
  });

  return { allowed: findings.length === 0, findings };
}
