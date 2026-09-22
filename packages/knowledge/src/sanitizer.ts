export type KnowledgeScan = {
  clean: boolean;
  findings: Array<{ code: "secret-like-value"; line: number }>;
};

const SECRET_PATTERNS = [/\bsk-[A-Za-z0-9_-]{20,}\b/, /\b(?:api[_-]?key|token|secret)\s*[:=]\s*[^\s]+/i];

export function scanKnowledgeBody(body: string): KnowledgeScan {
  const findings: KnowledgeScan["findings"] = [];
  for (const [index, line] of body.split("\n").entries()) {
    if (SECRET_PATTERNS.some((pattern) => pattern.test(line))) {
      findings.push({ code: "secret-like-value", line: index + 1 });
    }
  }
  if (findings.length > 0) throw new Error("secret-like value detected");
  return { clean: true, findings };
}
