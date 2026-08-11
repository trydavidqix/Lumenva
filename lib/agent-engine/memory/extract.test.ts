import { describe, expect, it, vi } from "vitest";

import {
  MemoryExtractionRetryableError,
  extractMemoryCandidates,
} from "./extract";

const input = {
  db: {} as never,
  llmConfig: {} as never,
  organizationId: "org-1",
  contactId: "contact-1",
  sourceMessageId: "message-1",
  sourceText: "Prefiro receber atualizações de entrega por WhatsApp à tarde.",
};

function modelReply(candidates: unknown): { result: { text: string } } {
  return { result: { text: JSON.stringify({ candidates }) } };
}

describe("extractMemoryCandidates", () => {
  it("extracts one low-risk preference through the model seam", async () => {
    const runModelCall = vi.fn().mockResolvedValue(modelReply([
      {
        type: "preference",
        authorityDomain: "customer_preference",
        risk: "low",
        confidence: 0.93,
        actionable: true,
        text: "Prefere atualizações de entrega por WhatsApp à tarde.",
      },
    ]));

    await expect(extractMemoryCandidates(input, { runModelCall } as never)).resolves.toEqual([
      {
        type: "preference",
        authorityDomain: "customer_preference",
        risk: "low",
        confidence: 0.93,
        actionable: true,
        text: "Prefere atualizações de entrega por WhatsApp à tarde.",
      },
    ]);

    expect(runModelCall).toHaveBeenCalledOnce();
    expect(runModelCall.mock.calls[0]?.[2]).toMatchObject({
      tenantId: "org-1",
      leadId: "contact-1",
      purpose: "memory_extraction",
    });
    expect(runModelCall.mock.calls[0]?.[2].messages[0].content).toContain("duráveis");
    expect(runModelCall.mock.calls[0]?.[2].messages[0].content).toContain("JSON estrito");
    expect(runModelCall.mock.calls[0]?.[2].messages[0].content).toContain("epistêmica");
  });

  it("marks payment authorization as high risk and never actionable", async () => {
    const runModelCall = vi.fn().mockResolvedValue(modelReply([
      {
        type: "commercial_context",
        authorityDomain: "consent",
        risk: "low",
        confidence: 0.87,
        actionable: true,
        text: "The customer said: I authorize payment.",
      },
    ]));

    await expect(extractMemoryCandidates(
      { ...input, sourceText: "I authorize payment." },
      { runModelCall } as never,
    )).resolves.toEqual([
      {
        type: "commercial_context",
        authorityDomain: "consent",
        risk: "high",
        confidence: 0.87,
        actionable: false,
        text: "The customer said: I authorize payment.",
      },
    ]);
  });

  it("does not return model candidates containing passwords or API keys", async () => {
    const runModelCall = vi.fn().mockResolvedValue(modelReply([
      {
        type: "preference",
        authorityDomain: "customer_preference",
        risk: "low",
        confidence: 0.8,
        actionable: true,
        text: "A senha é texto-sintético-que-nunca-deve-ser-armazenado.",
      },
      {
        type: "commercial_context",
        authorityDomain: "operational_state",
        risk: "medium",
        confidence: 0.8,
        actionable: false,
        text: "OPENAI_API_KEY=valor-sintético-que-nunca-deve-ser-armazenado",
      },
    ]));

    await expect(extractMemoryCandidates(input, { runModelCall } as never)).resolves.toEqual([]);
  });

  it.each([
    ["invalid JSON", { result: { text: "não é JSON" } }],
    ["an invalid model schema", modelReply([{ type: "preference", text: "Falta o restante do contrato." }])],
  ])("fails retryably for %s instead of returning arbitrary memory", async (_caseName, response) => {
    const runModelCall = vi.fn().mockResolvedValue(response);

    await expect(extractMemoryCandidates(input, { runModelCall } as never)).rejects.toBeInstanceOf(
      MemoryExtractionRetryableError,
    );
  });

  it("returns no candidates when the model finds no durable fact", async () => {
    const runModelCall = vi.fn().mockResolvedValue(modelReply([]));

    await expect(extractMemoryCandidates(
      { ...input, sourceText: "Obrigado!" },
      { runModelCall } as never,
    )).resolves.toEqual([]);
  });
});
