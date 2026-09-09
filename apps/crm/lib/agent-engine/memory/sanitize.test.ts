import { describe, expect, it } from "vitest";

import { sanitizeMemoryCandidate } from "./sanitize";

describe("sanitizeMemoryCandidate", () => {
  it.each([
    ["an API-key-looking value", "A chave da API é sk-proj-abcdefghijklmnopqrstuvwxyz0123456789."],
    ["a bearer credential", "Use Bearer credential-that-must-never-be-stored."],
    ["a JWT", "O token é eyJhbGciOiJub25lIn0.eyJzdWIiOiJjb250YWN0In0.signaturevalue."],
    ["a session assignment", "session=customer-session-secret"],
    ["a cookie header", "Cookie: session=customer-session-secret"],
    ["a natural-language access-token assignment", "access token é credential-value"],
    ["a natural-language session-ID assignment", "session id is credential-value"],
    ["a natural-language cookie assignment", "cookie é session-value"],
    ["a password statement", "A senha do cliente é sem-acesso-a-memória."],
    ["a recovery-code statement", "Código de recuperação: 1234-5678-9012"],
    ["a full card number", "Cartão: 4111 1111 1111 1111"],
    ["a card-length sequence that fails Luhn", "Número informado: 1234 5678 9012 3456"],
    ["a CVV", "CVV: 123"],
    ["a CVV without an assignment separator", "CVV 123"],
    ["a punctuated CPF", "Meu CPF é 123.456.789-00 caso precise pra nota fiscal."],
    ["a bare CPF", "CPF 12345678900 para nota fiscal."],
    ["an internal secret variable name", "OPENAI_API_KEY=should-not-be-persisted"],
    ["an ambiguous token assignment", "access_token=customer-provided-value"],
  ])("blocks %s", (_caseName, text) => {
    const result = sanitizeMemoryCandidate({ text, type: "preference" });

    expect(result.allowed).toBe(false);
  });

  it("preserves an ordinary customer preference", () => {
    const text = "Prefere receber atualizações de entrega por WhatsApp no período da tarde.";

    expect(sanitizeMemoryCandidate({ text, type: "preference" })).toEqual({ allowed: true, text });
  });

  it("preserves ordinary commercial context", () => {
    const text = "A empresa usa cinco atendentes e quer avaliar automações para o suporte comercial.";

    expect(sanitizeMemoryCandidate({ text, type: "commercial_context" })).toEqual({ allowed: true, text });
  });
});
