import { Document, MarkdownNodeParser, SentenceSplitter } from "llamaindex";
import { describe, expect, it } from "vitest";

import { computeContentHash } from "@/lib/ai/rag/chunker";

import { LlamaIndexIngestionAdapter } from "./llamaindex-adapter";
import type { IngestionDocument } from "./port";

const baseMetadata = {
  organizationId: "org-7f3c",
  sourceId: "policy-reembolso",
  sourceVersion: "3",
  title: "Política de Reembolso",
};

const longPolicyText = [
  "# Política de Reembolso da Loja",
  "",
  "## Prazos",
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
  "## Trocas",
  "",
  "Trocas por produtos de valor diferente geram cobrança ou estorno da diferença, conforme o caso, e são processadas pelo mesmo canal do pagamento original.",
].join("\n");

/**
 * Recomputes the expected split independently from the adapter, the same way
 * native-adapter.test.ts calls chunkText() directly, so the test proves the
 * adapter's output matches LlamaIndex.TS's OSS transformations rather than
 * asserting against itself.
 */
function expectedChunks(text: string, chunkSize = 400, chunkOverlap = 50): string[] {
  const doc = new Document({ text, metadata: {} });
  const headingNodes = new MarkdownNodeParser().getNodesFromDocuments([doc]);
  const splitter = new SentenceSplitter({ chunkSize, chunkOverlap });
  return splitter
    .getNodesFromDocuments(headingNodes)
    .map((node) => node.text.trim())
    .filter((text) => text.length > 0);
}

describe("LlamaIndexIngestionAdapter", () => {
  it("splits a heading-structured markdown document identically to MarkdownNodeParser + SentenceSplitter at the default budget", async () => {
    const adapter = new LlamaIndexIngestionAdapter();
    const document: IngestionDocument = { text: longPolicyText, metadata: baseMetadata };

    const nodes = await adapter.normalize(document);
    const expected = expectedChunks(longPolicyText);

    expect(expected.length).toBeGreaterThan(1);
    expect(nodes.map((n) => n.text)).toEqual(expected);
  });

  it("assigns position as the zero-based index matching output order", async () => {
    const adapter = new LlamaIndexIngestionAdapter();
    const document: IngestionDocument = { text: longPolicyText, metadata: baseMetadata };

    const nodes = await adapter.normalize(document);

    nodes.forEach((node, index) => {
      expect(node.position).toBe(index);
    });
  });

  it("attaches a per-chunk contentHash equal to computeContentHash(node.text)", async () => {
    const adapter = new LlamaIndexIngestionAdapter();
    const document: IngestionDocument = { text: longPolicyText, metadata: baseMetadata };

    const nodes = await adapter.normalize(document);

    for (const node of nodes) {
      expect(node.metadata["contentHash"]).toBe(computeContentHash(node.text));
    }
  });

  it("preserves source metadata (organizationId, sourceId, sourceVersion, title) on every node", async () => {
    const adapter = new LlamaIndexIngestionAdapter();
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

  it("attaches a headerPath derived from the document's markdown heading structure", async () => {
    const adapter = new LlamaIndexIngestionAdapter();
    const document: IngestionDocument = { text: longPolicyText, metadata: baseMetadata };

    const nodes = await adapter.normalize(document);

    expect(nodes[0]?.metadata["headerPath"]).toBe("Política de Reembolso da Loja");
    const prazosNode = nodes.find((n) => n.text.includes("Reembolsos são processados"));
    const trocasNode = nodes.find((n) => n.text.includes("Trocas por produtos de valor diferente"));
    expect(prazosNode?.metadata["headerPath"]).toBe("Política de Reembolso da Loja > Prazos");
    expect(trocasNode?.metadata["headerPath"]).toBe("Política de Reembolso da Loja > Trocas");
  });

  it("produces two different content hashes for two chunks with different text", async () => {
    const adapter = new LlamaIndexIngestionAdapter();
    const document: IngestionDocument = { text: longPolicyText, metadata: baseMetadata };

    const nodes = await adapter.normalize(document);
    const hashes = nodes.map((n) => n.metadata["contentHash"]);

    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it("returns a single node with an empty headerPath for plain text without markdown headings", async () => {
    const adapter = new LlamaIndexIngestionAdapter();
    const shortText = "Trocas são aceitas em até 7 dias após o recebimento.";
    const document: IngestionDocument = { text: shortText, metadata: baseMetadata };

    const nodes = await adapter.normalize(document);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.text).toBe(shortText);
    expect(nodes[0]?.position).toBe(0);
    expect(nodes[0]?.metadata["headerPath"]).toBe("");
    expect(nodes[0]?.metadata["contentHash"]).toBe(computeContentHash(shortText));
  });

  it("aborts by returning no nodes for whitespace-only input, mirroring the native adapter", async () => {
    const adapter = new LlamaIndexIngestionAdapter();
    const document: IngestionDocument = { text: "   \n\n  ", metadata: baseMetadata };

    const nodes = await adapter.normalize(document);

    expect(nodes).toEqual([]);
  });

  it("aborts by returning no nodes for an empty string", async () => {
    const adapter = new LlamaIndexIngestionAdapter();
    const document: IngestionDocument = { text: "", metadata: baseMetadata };

    const nodes = await adapter.normalize(document);

    expect(nodes).toEqual([]);
  });

  it("is deterministic across repeated calls on the same document", async () => {
    const adapter = new LlamaIndexIngestionAdapter();
    const document: IngestionDocument = { text: longPolicyText, metadata: baseMetadata };

    const first = await adapter.normalize(document);
    const second = await adapter.normalize(document);

    expect(second).toEqual(first);
  });

  it("honors a custom chunkSize/chunkOverlap and matches SentenceSplitter's own output at that budget", async () => {
    const adapter = new LlamaIndexIngestionAdapter({ chunkSize: 150, chunkOverlap: 20 });
    const document: IngestionDocument = { text: longPolicyText, metadata: baseMetadata };

    const nodes = await adapter.normalize(document);
    const expected = expectedChunks(longPolicyText, 150, 20);
    const defaultCount = expectedChunks(longPolicyText).length;

    expect(nodes.map((n) => n.text)).toEqual(expected);
    expect(nodes.length).toBeGreaterThan(defaultCount);
  });
});
