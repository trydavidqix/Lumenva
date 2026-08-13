import { describe, expect, it } from "vitest";

import { scanPublishableKnowledge } from "./sanitize";

function markdownWithLine(secretLine: string, lineIndex: number): string {
  const lines = [
    "# Política de Reembolso",
    "",
    "Este documento descreve o processo de reembolso.",
    "",
    "Mais uma linha de contexto antes do segredo.",
  ];
  lines[lineIndex] = secretLine;
  return lines.join("\n");
}

describe("scanPublishableKnowledge", () => {
  it("allows an ordinary policy document with no secrets or PII", () => {
    const markdown = [
      "# Política de Reembolso",
      "",
      "Reembolsos são processados em até 5 dias úteis após a solicitação.",
      "",
      "Para mais detalhes, consulte o time de suporte pelo painel do CRM.",
    ].join("\n");

    expect(scanPublishableKnowledge(markdown)).toEqual({ allowed: true, findings: [] });
  });

  describe("secret categories", () => {
    it.each([
      ["an OpenAI-style API key", "Chave: sk-proj-abcdefghijklmnopqrstuvwxyz0123456789", "api_key"],
      ["an AWS access key id", "AWS_ACCESS_KEY_ID=***REMOVED***", "api_key"],
      ["a natural-language api key assignment", "A chave da API é minha-chave-secreta-123", "api_key"],
      [
        "a bearer credential header",
        "Authorization: Bearer abcdef123456.ghijkl789012.mnopqr345678",
        "credential",
      ],
      [
        "a bare JWT-looking value",
        "Token: ***REMOVED***",
        "credential",
      ],
      ["a password statement with colon", "Senha: SuperSecreta123!", "password_or_recovery_code"],
      [
        "a natural-language password statement",
        "A senha do administrador é SuperSecreta123!",
        "password_or_recovery_code",
      ],
      [
        "a recovery code statement",
        "Código de recuperação: 8842-1193-5567",
        "password_or_recovery_code",
      ],
      [
        "an env-style secret line",
        "DATABASE_PASSWORD=r3placeMe-not-a-real-password",
        "env_secret",
      ],
      ["a session assignment", "session=abc123session456token789", "session_or_cookie"],
      ["a Set-Cookie header", "Set-Cookie: sessionid=abc123session456token789", "session_or_cookie"],
      [
        "a private key header",
        "-----BEGIN RSA PRIVATE KEY-----",
        "private_key",
      ],
    ])("blocks %s with code %s", (_caseName, secretLine, expectedCode) => {
      const markdown = markdownWithLine(secretLine, 2);

      const result = scanPublishableKnowledge(markdown);

      expect(result.allowed).toBe(false);
      expect(result.findings).toEqual([{ code: expectedCode, line: 3 }]);
    });

    it("does not flag an ordinary env var as a secret", () => {
      const markdown = markdownWithLine("NODE_ENV=production", 2);

      expect(scanPublishableKnowledge(markdown)).toEqual({ allowed: true, findings: [] });
    });
  });

  describe("personal contact details", () => {
    it("flags a personal email when the document is not classified as a contact directory", () => {
      const markdown = markdownWithLine("Contato: joao.silva@example.com", 2);

      const result = scanPublishableKnowledge(markdown);

      expect(result.allowed).toBe(false);
      expect(result.findings).toEqual([{ code: "personal_email", line: 3 }]);
    });

    it("flags a personal phone number when the document is not classified as a contact directory", () => {
      const markdown = markdownWithLine("Telefone: (11) 91234-5678", 2);

      const result = scanPublishableKnowledge(markdown);

      expect(result.allowed).toBe(false);
      expect(result.findings).toEqual([{ code: "personal_phone", line: 3 }]);
    });

    it("allows email and phone when the document is explicitly classified as an allowed contact directory", () => {
      const markdown = [
        "<!-- knowledge-content-type: contact-directory -->",
        "# Diretório de Contatos",
        "",
        "Contato: joao.silva@example.com",
        "Telefone: (11) 91234-5678",
      ].join("\n");

      expect(scanPublishableKnowledge(markdown)).toEqual({ allowed: true, findings: [] });
    });

    it("still blocks secrets inside a document classified as a contact directory", () => {
      const markdown = [
        "<!-- knowledge-content-type: contact-directory -->",
        "# Diretório de Contatos",
        "",
        "Contato: joao.silva@example.com",
        "AWS_ACCESS_KEY_ID=***REMOVED***",
      ].join("\n");

      const result = scanPublishableKnowledge(markdown);

      expect(result.allowed).toBe(false);
      expect(result.findings).toEqual([{ code: "api_key", line: 5 }]);
    });
  });

  describe("multiple findings", () => {
    it("reports every offending line with its own line number, in document order", () => {
      const markdown = [
        "# Runbook interno",
        "AWS_ACCESS_KEY_ID=***REMOVED***",
        "Texto normal no meio do documento.",
        "Senha: SuperSecreta123!",
        "Outro texto normal.",
        "-----BEGIN PRIVATE KEY-----",
      ].join("\n");

      const result = scanPublishableKnowledge(markdown);

      expect(result.allowed).toBe(false);
      expect(result.findings).toEqual([
        { code: "api_key", line: 2 },
        { code: "password_or_recovery_code", line: 4 },
        { code: "private_key", line: 6 },
      ]);
    });
  });

  describe("no value leakage", () => {
    it("never includes the matched secret value anywhere in the result", () => {
      const secretValue = "sk-proj-thisIsAVeryUniqueSecretValue999";
      const markdown = markdownWithLine(`Chave: ${secretValue}`, 2);

      const result = scanPublishableKnowledge(markdown);

      expect(JSON.stringify(result)).not.toContain(secretValue);
    });

    it("finding objects only ever contain code and line keys", () => {
      const markdown = markdownWithLine("Senha: SuperSecreta123!", 2);

      const result = scanPublishableKnowledge(markdown);

      for (const finding of result.findings) {
        expect(Object.keys(finding).sort()).toEqual(["code", "line"]);
      }
    });
  });
});
