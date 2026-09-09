import { describe, expect, it } from "vitest";

import type { IngestionDocument, IngestionNode, KnowledgeIngestionPort } from "./port";

class EchoIngestionPort implements KnowledgeIngestionPort {
  async normalize(document: IngestionDocument): Promise<IngestionNode[]> {
    return [
      {
        text: document.text,
        position: 0,
        metadata: {
          organizationId: document.metadata.organizationId,
          sourceId: document.metadata.sourceId,
          sourceVersion: document.metadata.sourceVersion,
          title: document.metadata.title,
        },
      },
    ];
  }
}

describe("KnowledgeIngestionPort", () => {
  it("accepts any implementation matching the normalize(document) => nodes[] contract", async () => {
    const port: KnowledgeIngestionPort = new EchoIngestionPort();
    const document: IngestionDocument = {
      text: "Horário de atendimento: segunda a sexta, das 9h às 18h.",
      metadata: {
        organizationId: "org-1",
        sourceId: "faq-horario",
        sourceVersion: "1",
        title: "FAQ — Horário de atendimento",
      },
    };

    const nodes = await port.normalize(document);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      text: document.text,
      position: 0,
      metadata: {
        organizationId: "org-1",
        sourceId: "faq-horario",
        sourceVersion: "1",
        title: "FAQ — Horário de atendimento",
      },
    });
  });

  it("allows node metadata values restricted to string | number | boolean | null", async () => {
    const port: KnowledgeIngestionPort = {
      async normalize(): Promise<IngestionNode[]> {
        return [
          {
            text: "chunk",
            position: 0,
            metadata: {
              organizationId: "org-1",
              tokenCount: 42,
              active: true,
              parentId: null,
            },
          },
        ];
      },
    };

    const nodes = await port.normalize({
      text: "chunk",
      metadata: { organizationId: "org-1", sourceId: "s-1", sourceVersion: "1", title: "t" },
    });

    expect(nodes[0]?.metadata).toEqual({
      organizationId: "org-1",
      tokenCount: 42,
      active: true,
      parentId: null,
    });
  });
});
