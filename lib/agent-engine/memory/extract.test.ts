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
        sensitiveClassification: "none",
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
        sensitiveClassification: "none",
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

  it.each([
    [
      "a consent authority domain",
      {
        type: "preference",
        authorityDomain: "consent",
        sensitiveClassification: "none",
        risk: "low",
        confidence: 0.87,
        actionable: true,
        text: "O cliente confirmou a escolha de receber comunicações.",
      },
    ],
    [
      "a legal authority domain",
      {
        type: "commercial_context",
        authorityDomain: "legal",
        sensitiveClassification: "none",
        risk: "low",
        confidence: 0.87,
        actionable: true,
        text: "O cliente concordou com os termos da proposta.",
      },
    ],
    [
      "a non-keyword contract classification",
      {
        type: "commercial_context",
        authorityDomain: "commercial_status",
        sensitiveClassification: "contract",
        risk: "low",
        confidence: 0.87,
        actionable: true,
        text: "O cliente aceitou os termos da proposta.",
      },
    ],
    [
      "a non-keyword payment classification",
      {
        type: "commercial_context",
        authorityDomain: "commercial_status",
        sensitiveClassification: "payment",
        risk: "low",
        confidence: 0.87,
        actionable: true,
        text: "O cliente aprovou a cobrança recorrente.",
      },
    ],
  ])("marks %s as high risk and never actionable", async (_caseName, modelCandidate) => {
    const runModelCall = vi.fn().mockResolvedValue(modelReply([modelCandidate]));

    await expect(extractMemoryCandidates(
      { ...input, sourceText: modelCandidate.text },
      { runModelCall } as never,
    )).resolves.toEqual([
      { ...modelCandidate, risk: "high", actionable: false },
    ]);
  });

  it.each([
    ["a settled invoice", "A fatura foi quitada."],
    ["a signed agreement", "As partes assinaram o acordo."],
    ["a completed bank transfer", "transferência bancária concluída"],
    ["an annual subscription renewal", "subscrição anual renovada"],
  ])("fails closed for %s even when the model labels it non-sensitive", async (_caseName, text) => {
    const modelCandidate = {
      type: "commercial_context",
      authorityDomain: "commercial_status",
      sensitiveClassification: "none",
      risk: "low",
      confidence: 0.87,
      actionable: true,
      text,
    };
    const runModelCall = vi.fn().mockResolvedValue(modelReply([modelCandidate]));

    await expect(extractMemoryCandidates(
      { ...input, sourceText: text },
      { runModelCall } as never,
    )).resolves.toEqual([
      { ...modelCandidate, risk: "high", actionable: false },
    ]);
  });

  it("marks ordinary commercial status as high risk and never actionable", async () => {
    const modelCandidate = {
      type: "commercial_context",
      authorityDomain: "commercial_status",
      sensitiveClassification: "none",
      risk: "low",
      confidence: 0.87,
      actionable: true,
      text: "A empresa possui cinco atendentes.",
    };
    const runModelCall = vi.fn().mockResolvedValue(modelReply([modelCandidate]));

    await expect(extractMemoryCandidates(
      { ...input, sourceText: modelCandidate.text },
      { runModelCall } as never,
    )).resolves.toEqual([
      { ...modelCandidate, risk: "high", actionable: false },
    ]);
  });

  it("does not return model candidates containing passwords or API keys", async () => {
    const runModelCall = vi.fn().mockResolvedValue(modelReply([
      {
        type: "preference",
        authorityDomain: "customer_preference",
        sensitiveClassification: "none",
        risk: "low",
        confidence: 0.8,
        actionable: true,
        text: "A senha é texto-sintético-que-nunca-deve-ser-armazenado.",
      },
      {
        type: "commercial_context",
        authorityDomain: "operational_state",
        sensitiveClassification: "none",
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

  it("keeps a supersedes id the model referenced, when it's one of the ids it was actually shown", async () => {
    const runModelCall = vi.fn().mockResolvedValue(modelReply([
      {
        type: "preference",
        authorityDomain: "customer_preference",
        sensitiveClassification: "none",
        risk: "low",
        confidence: 0.9,
        actionable: true,
        text: "Prefere WhatsApp, não ligações.",
        supersedes: ["memory:old:0"],
      },
    ]));

    const result = await extractMemoryCandidates(
      { ...input, existingMemories: [{ id: "memory:old:0", text: "Prefere ligação telefônica." }] },
      { runModelCall } as never,
    );

    expect(result[0]?.supersedes).toEqual(["memory:old:0"]);
  });

  it("drops a supersedes id the model invented — never an id it wasn't actually shown", async () => {
    const runModelCall = vi.fn().mockResolvedValue(modelReply([
      {
        type: "preference",
        authorityDomain: "customer_preference",
        sensitiveClassification: "none",
        risk: "low",
        confidence: 0.9,
        actionable: true,
        text: "Prefere WhatsApp, não ligações.",
        supersedes: ["memory:old:0", "memory:hallucinated:99"],
      },
    ]));

    const result = await extractMemoryCandidates(
      { ...input, existingMemories: [{ id: "memory:old:0", text: "Prefere ligação telefônica." }] },
      { runModelCall } as never,
    );

    expect(result[0]?.supersedes).toEqual(["memory:old:0"]);
  });

  it("without existingMemories, any supersedes the model still emits is entirely filtered out", async () => {
    const runModelCall = vi.fn().mockResolvedValue(modelReply([
      {
        type: "preference",
        authorityDomain: "customer_preference",
        sensitiveClassification: "none",
        risk: "low",
        confidence: 0.9,
        actionable: true,
        text: "Prefere WhatsApp.",
        supersedes: ["memory:whatever:0"],
      },
    ]));

    const result = await extractMemoryCandidates(input, { runModelCall } as never);

    expect(result[0]?.supersedes).toEqual([]);
  });

  it("includes known existing memories in the prompt so the model can judge contradiction", async () => {
    const runModelCall = vi.fn().mockResolvedValue(modelReply([]));

    await extractMemoryCandidates(
      { ...input, existingMemories: [{ id: "memory:old:0", text: "Prefere ligação telefônica." }] },
      { runModelCall } as never,
    );

    const prompt = runModelCall.mock.calls[0]?.[2]?.messages?.[0]?.content as string;
    expect(prompt).toContain("memory:old:0");
    expect(prompt).toContain("Prefere ligação telefônica.");
  });

  it("tolerates the model wrapping its JSON in a markdown code fence, despite being told not to", async () => {
    // Observed against the real Anthropic API while validating this: the
    // prompt says "SOMENTE JSON estrito, sem markdown" and the model still
    // sometimes wraps the object in a ```json fence. A prompt instruction is
    // not a parser guarantee.
    const candidates = [
      {
        type: "preference",
        authorityDomain: "customer_preference",
        sensitiveClassification: "none",
        risk: "low",
        confidence: 0.9,
        actionable: true,
        text: "Prefere ser contatado só depois das 18h.",
      },
    ];
    const fenced = `\`\`\`json\n${JSON.stringify({ candidates })}\n\`\`\``;
    const runModelCall = vi.fn().mockResolvedValue({ result: { text: fenced } });

    await expect(extractMemoryCandidates(input, { runModelCall } as never)).resolves.toEqual(candidates);
  });

  it("returns no candidates when the model finds no durable fact", async () => {
    const runModelCall = vi.fn().mockResolvedValue(modelReply([]));

    await expect(extractMemoryCandidates(
      { ...input, sourceText: "Obrigado!" },
      { runModelCall } as never,
    )).resolves.toEqual([]);
  });
});
