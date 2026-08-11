import { describe, expect, it } from "vitest";

import { sanitizeMemoryCandidate } from "./sanitize";

describe("sanitizeMemoryCandidate", () => {
  it.each([
    ["an API-key-looking value", "A chave da API é sk-proj-abcdefghijklmnopqrstuvwxyz0123456789."],
    ["a bearer credential", "Use Bearer credential-that-must-never-be-stored."],
    ["a JWT", "O token é eyJhbGciOiJub25lIn0.eyJzdWIiOiJjb250YWN0In0.signaturevalue."],
    ["a session assignment", "session=customer-session-secret"],
    ["a cookie header", "Cookie: session=customer-session-secret"],
    ["a password statement", "A senha do cliente é sem-acesso-a-memória."],
    ["a recovery-code statement", "Código de recuperação: 1234-5678-9012"],
    ["a full card number", "Cartão: 4111 1111 1111 1111"],
    ["a CVV", "CVV: 123"],
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
