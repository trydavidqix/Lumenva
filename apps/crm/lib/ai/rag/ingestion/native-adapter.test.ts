import { describe, expect, it } from "vitest";

import { chunkText, computeContentHash } from "@/lib/ai/rag/chunker";

import { NativeIngestionAdapter } from "./native-adapter";
import type { IngestionDocument } from "./port";

const baseMetadata = {
  organizationId: "org-7f3c",
  sourceId: "policy-reembolso",
  sourceVersion: "3",
  title: "Política de Reembolso",
};

const longPolicyText = [
  "Política de Reembolso da Loja",
  "",
  "Reembolsos são processados em até 5 dias úteis após a confirmação de recebimento do produto devolvido. " +
    "O cliente deve solicitar a devolução pelo painel de pedidos, informando o motivo da troca ou cancelamento. " +
    "Produtos com lacre violado ou sinais de uso não são elegíveis para reembolso integral, exceto em caso de defeito de fabricação comprovado por laudo técnico. " +
    "Roupas e calçados podem ser trocados por tamanho em até 30 dias corridos, desde que mantida a etiqueta original. " +
    "Itens de higiene pessoal, como maquiagem e produtos íntimos, não aceitam devolução por motivo sanitário, salvo defeito de fabricação. " +
    "O frete de devolução é gratuito quando o motivo é defeito do produto ou erro de envio por parte da loja; nos demais casos, o custo é do cliente. " +
    "Pedidos pagos via cartão de crédito têm o estorno processado pela operadora em até duas faturas subsequentes. " +
    "Pedidos pagos via Pix ou boleto recebem o reembolso diretamente na conta informada pelo cliente em até 5 dias úteis.",
  "",
  "Trocas por produtos de valor diferente geram cobrança ou estorno da diferença, conforme o caso, e são processadas pelo mesmo canal do pagamento original.",
].join("\n\n");

describe("NativeIngestionAdapter", () => {
  it("splits a real multi-paragraph document identically to chunkText's current defaults", async () => {
    const adapter = new NativeIngestionAdapter();
    const document: IngestionDocument = { text: longPolicyText, metadata: baseMetadata };

    const nodes = await adapter.normalize(document);
    const expectedChunks = chunkText(longPolicyText);

    expect(expectedChunks.length).toBeGreaterThan(1);
    expect(nodes.map((n) => n.text)).toEqual(expectedChunks);
  });

  it("assigns position as the zero-based index matching chunkText's output order", async () => {
    const adapter = new NativeIngestionAdapter();
    const document: IngestionDocument = { text: longPolicyText, metadata: baseMetadata };

    const nodes = await adapter.normalize(document);

    nodes.forEach((node, index) => {
      expect(node.position).toBe(index);
    });
  });

  it("attaches a per-chunk contentHash equal to computeContentHash(chunkText result)", async () => {
    const adapter = new NativeIngestionAdapter();
    const document: IngestionDocument = { text: longPolicyText, metadata: baseMetadata };

    const nodes = await adapter.normalize(document);
    const expectedChunks = chunkText(longPolicyText);

    nodes.forEach((node, index) => {
      expect(node.metadata["contentHash"]).toBe(computeContentHash(expectedChunks[index]!));
    });
  });

  it("preserves source metadata (organizationId, sourceId, sourceVersion, title) on every node", async () => {
    const adapter = new NativeIngestionAdapter();
    const document: IngestionDocument = { text: longPolicyText, metadata: baseMetadata };

    const nodes = await adapter.normalize(document);

    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(node.metadata["organizationId"]).toBe(baseMetadata.organizationId);
      expect(node.metadata["sourceId"]).toBe(baseMetadata.sourceId);
      expect(node.metadata["sourceVersion"]).toBe(baseMetadata.sourceVersion);
      expect(node.metadata["title"]).toBe(baseMetadata.title);
    }
  });

  it("produces two different content hashes for two chunks with different text", async () => {
    const adapter = new NativeIngestionAdapter();
    const document: IngestionDocument = { text: longPolicyText, metadata: baseMetadata };

    const nodes = await adapter.normalize(document);
    const hashes = nodes.map((n) => n.metadata["contentHash"]);

    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it("mirrors chunkText's single-chunk behavior for short text below maxChars", async () => {
    const adapter = new NativeIngestionAdapter();
    const shortText = "Trocas são aceitas em até 7 dias após o recebimento.";
    const document: IngestionDocument = {
      text: shortText,
      metadata: baseMetadata,
    };

    const nodes = await adapter.normalize(document);

    expect(nodes).toEqual([
      {
        text: shortText,
        position: 0,
        metadata: {
          organizationId: baseMetadata.organizationId,
          sourceId: baseMetadata.sourceId,
          sourceVersion: baseMetadata.sourceVersion,
          title: baseMetadata.title,
          contentHash: computeContentHash(shortText),
        },
      },
    ]);
  });

  it("mirrors chunkText's empty-input behavior by returning no nodes", async () => {
    const adapter = new NativeIngestionAdapter();
    const document: IngestionDocument = { text: "   \n\n  ", metadata: baseMetadata };

    const nodes = await adapter.normalize(document);

    expect(nodes).toEqual([]);
    expect(chunkText(document.text)).toEqual([]);
  });
});
