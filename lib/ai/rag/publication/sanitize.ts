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

// Filler word group shared by strict and natural branches below: real
// sentences put descriptive words between the keyword and the separator
// ("a senha do administrador: valor", "o código de recuperação do usuário:
// valor"), regardless of whether the separator is a literal `:`/`=` or the
// natural-language "é"/"is".
const FILLER_WORDS = "(?:\\s+[A-Za-zÀ-ÿ]+){0,4}";

// Both separator shapes now capture their value and are validated through
// looksCredentialShaped — an explicit `:`/`=` is a stronger signal than the
// natural-language "é"/"is", but it is not by itself proof of a real secret:
// "Password policy: no reuse in the last 90 days." and "Duração da sessão:
// 30 minutos." are colon-headed prose, not leaked credentials. Only the
// *value* shape tells the two apart, so every branch below captures it and
// runs it through the same gate.
const API_KEY_STRICT_ASSIGNMENT = new RegExp(
  `\\b(?:api[_ -]?key|apikey|chave\\s+(?:da|de)\\s+api)\\b\\s*(?:=|:)\\s*(\\S+)`,
  "iu",
);
const API_KEY_NATURAL_ASSIGNMENT = new RegExp(
  `\\b(?:api[_ -]?key|apikey|chave\\s+(?:da|de)\\s+api)\\b${FILLER_WORDS}\\s*(?:é|is)\\s+(\\S+)`,
  "iu",
);
const API_KEY_LIKE_VALUE =
  /\b(?:sk|rk|pk|ghp|gho|ghu|ghs|ghr|github_pat|xox[baprs])[-_][A-Za-z0-9_-]{10,}\b|\b(?:AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35})\b/;

const BEARER_TOKEN = /\bbearer\s+\S+/iu;
const JWT_LIKE_VALUE = /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/;

// Portuguese phrasing puts "token"/"sessão" in either order ("session
// token" vs "token de sessão"), so both are covered explicitly instead of
// relying on one canonical word order. "Sessão" alone is heavily used in this
// CRM's domain vocabulary for messaging-channel session lifecycle ("Duração
// da sessão: 30 minutos.") and appears in legitimate knowledge-base prose
// constantly, which is exactly why the strict branch below is gated too, not
// just the natural one.
const SESSION_KEYWORD =
  "(?:set-cookie|cookie|session(?:[_ -]?(?:id|token|key))?|token\\s+de\\s+sess[aã]o|sess[aã]o(?:[_ -]?(?:id|token|key))?)";
const SESSION_OR_COOKIE_STRICT_ASSIGNMENT = new RegExp(
  `\\b${SESSION_KEYWORD}\\b\\s*(?:=|:)\\s*(\\S+)`,
  "iu",
);
const SESSION_OR_COOKIE_NATURAL_ASSIGNMENT = new RegExp(
  `\\b${SESSION_KEYWORD}\\b\\s*(?:é|is)\\s+(\\S+)`,
  "iu",
);

// Assignment-shaped on purpose (keyword ... separator ... value), not a bare
// keyword ban: a support knowledge base legitimately contains prose like
// "como redefinir sua senha" or "Password policy: no reuse...", and a
// blanket ban on the word (or on any colon following it) would make that
// unpublishable. Filler words are allowed between the keyword and *either*
// separator shape to cover phrasing like "a senha do administrador: valor"
// and "a senha do administrador é valor".
const PASSWORD_STRICT_ASSIGNMENT = new RegExp(
  `\\b(?:password|passwd|senha|passcode)\\b${FILLER_WORDS}\\s*(?:=|:)\\s*(\\S+)`,
  "iu",
);
const PASSWORD_NATURAL_ASSIGNMENT = new RegExp(
  `\\b(?:password|passwd|senha|passcode)\\b${FILLER_WORDS}\\s*(?:é|is)\\s+(\\S+)`,
  "iu",
);
const RECOVERY_CODE_STRICT_ASSIGNMENT = new RegExp(
  `\\b(?:recovery[ -]?code|backup[ -]?code|c[oó]digo\\s+de\\s+recupera[cç][aã]o)\\b${FILLER_WORDS}\\s*(?:=|:)\\s*(\\S+)`,
  "iu",
);
const RECOVERY_CODE_NATURAL_ASSIGNMENT = new RegExp(
  `\\b(?:recovery[ -]?code|backup[ -]?code|c[oó]digo\\s+de\\s+recupera[cç][aã]o)\\b${FILLER_WORDS}\\s*(?:é|is)\\s+(\\S+)`,
  "iu",
);

const ENV_ASSIGNMENT_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\S+/;
const ENV_SECRET_KEY_HINT =
  /API_?KEY|ACCESS_TOKEN|REFRESH_TOKEN|AUTH_TOKEN|CLIENT_SECRET|PRIVATE_KEY|DATABASE_PASSWORD|DB_PASSWORD|SESSION_TOKEN|SESSION_KEY|SECRET|PASSWORD|CREDENTIAL|TOKEN/i;

const EMAIL_CANDIDATE = /\b[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_CANDIDATE = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,3}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}\b/;

const CONTACT_DIRECTORY_MARKER =
  /<!--\s*knowledge-content-type\s*:\s*contact-directory\s*-->/i;

// Every assignment-shaped branch (strict `:`/`=` and natural "é"/"is"
// alike) only fires when the captured value itself looks like a credential
// rather than an ordinary word from the surrounding sentence ("policy",
// "30", "no", "usar", "armazenada", "temporary"). Two signals combine:
//
// 1. Minimum length. Real secrets in every fixture we have (this file's
//    tests, the sibling lib/agent-engine/memory/sanitize.ts fixtures) are
//    all 6+ characters; ordinary short words/numbers that show up right
//    after a colon in policy prose ("30", "no", "usar") are not. A short
//    value never counts as credential-shaped, regardless of what else is
//    true about it — this is what stops "Duração da sessão: 30 minutos."
//    from matching just because "30" contains a digit.
// 2. Shape, for anything long enough to pass (1): a digit anywhere, OR a
//    long (6+) unspaced run of only uppercase letters (how a generated
//    code like "ABCDEFGH" looks, not how Portuguese/English sentences
//    write real words), OR an internal lowercase-then-later-uppercase
//    transition (camelCase/PascalCase-with-inner-caps, e.g.
//    "minhaSenhaSecreta" — simple Title-Case with one leading capital is
//    excluded on purpose so this doesn't fire on every capitalized word).
//
// Quoted/backtick-wrapped values are the one unconditional exception:
// explicit quoting is already an intentional "this is a value" signal on
// its own, independent of length or shape.
const MIN_CREDENTIAL_LENGTH = 6;

function looksCredentialShaped(value: string): boolean {
  if (/^[`"'].+[`"']$/.test(value)) {
    return true;
  }
  if (value.length < MIN_CREDENTIAL_LENGTH) {
    return false;
  }
  if (/\d/.test(value)) {
    return true;
  }
  if (/^[A-Z]{6,}$/.test(value)) {
    return true;
  }
  return /[a-z].*[A-Z]/.test(value);
}

function matchesGatedAssignment(pattern: RegExp, line: string): boolean {
  const match = pattern.exec(line);
  const value = match?.[1];
  return value !== undefined && looksCredentialShaped(value);
}

function scanLine(line: string): string | null {
  if (PRIVATE_KEY_HEADER.test(line)) {
    return "private_key";
  }
  if (
    API_KEY_LIKE_VALUE.test(line) ||
    matchesGatedAssignment(API_KEY_STRICT_ASSIGNMENT, line) ||
    matchesGatedAssignment(API_KEY_NATURAL_ASSIGNMENT, line)
  ) {
    return "api_key";
  }
  if (BEARER_TOKEN.test(line) || JWT_LIKE_VALUE.test(line)) {
    return "credential";
  }
  if (
    matchesGatedAssignment(SESSION_OR_COOKIE_STRICT_ASSIGNMENT, line) ||
    matchesGatedAssignment(SESSION_OR_COOKIE_NATURAL_ASSIGNMENT, line)
  ) {
    return "session_or_cookie";
  }
  if (
    matchesGatedAssignment(PASSWORD_STRICT_ASSIGNMENT, line) ||
    matchesGatedAssignment(RECOVERY_CODE_STRICT_ASSIGNMENT, line) ||
    matchesGatedAssignment(PASSWORD_NATURAL_ASSIGNMENT, line) ||
    matchesGatedAssignment(RECOVERY_CODE_NATURAL_ASSIGNMENT, line)
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
