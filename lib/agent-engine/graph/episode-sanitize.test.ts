import { describe, expect, it } from "vitest";

import { sanitizeGraphEpisode } from "./episode-sanitize";
import type { GraphEpisode } from "./types";

function episode(overrides: Partial<GraphEpisode> = {}): GraphEpisode {
  return {
    organizationId: "org-1",
    sourceId: "message-1",
    sourceVersion: "v1",
    name: "conversation-snippet",
    body: "Cliente perguntou sobre o prazo de entrega do pedido.",
    sourceType: "message",
    sourceDescription: "whatsapp conversation",
    referenceTime: "2026-08-14T10:00:00.000Z",
    ...overrides,
  };
}

describe("sanitizeGraphEpisode", () => {
  it.each([
    ["an API-key-looking value", "A chave da API é sk-proj-abcdefghijklmnopqrstuvwxyz0123456789."],
    ["a bearer credential", "Use Bearer credential-that-must-never-be-stored."],
    ["a JWT", "O token é eyJhbGciOiJub25lIn0.eyJzdWIiOiJjb250YWN0In0.signaturevalue."],
    ["a session assignment", "session=customer-session-secret"],
    ["a password statement", "A senha do cliente é sem-acesso-a-memória."],
    ["a recovery-code statement", "Código de recuperação: 1234-5678-9012"],
    ["a full card number", "Cartão: 4111 1111 1111 1111"],
    ["a CVV", "CVV: 123"],
    ["a punctuated CPF", "Meu CPF é 123.456.789-00 caso precise pra nota fiscal."],
    ["an internal secret variable name", "OPENAI_API_KEY=should-not-be-persisted"],
  ])("blocks %s in the episode body", (_caseName, secretText) => {
    const result = sanitizeGraphEpisode(episode({ body: secretText }));

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason.startsWith("body:")).toBe(true);
    }
  });

  it("blocks a secret carried in the episode name", () => {
    const result = sanitizeGraphEpisode(episode({ name: "token=credential-value" }));

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason.startsWith("name:")).toBe(true);
    }
  });

  it("blocks a secret carried in the sourceDescription", () => {
    const result = sanitizeGraphEpisode(
      episode({ sourceDescription: "internal export using access_token=customer-provided-value" }),
    );

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason.startsWith("sourceDescription:")).toBe(true);
    }
  });

  it("allows an ordinary conversational episode unchanged", () => {
    const clean = episode();

    const result = sanitizeGraphEpisode(clean);

    expect(result).toEqual({ allowed: true, episode: clean });
  });

  it("allows an ordinary JSON-sourced episode", () => {
    const clean = episode({
      sourceType: "json",
      body: JSON.stringify({ intent: "pricing_question", plan: "pro" }),
    });

    const result = sanitizeGraphEpisode(clean);

    expect(result).toEqual({ allowed: true, episode: clean });
  });
});
