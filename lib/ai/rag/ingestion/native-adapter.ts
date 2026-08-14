import { chunkText, computeContentHash } from "@/lib/ai/rag/chunker";

import type { IngestionDocument, IngestionNode, KnowledgeIngestionPort } from "./port";

/**
 * Wraps the CRM's existing chunking behavior (`chunkText`/`computeContentHash`
 * from `lib/ai/rag/chunker.ts`, unchanged) behind `KnowledgeIngestionPort` so a
 * later LlamaIndex-based adapter can be swapped in behind a feature flag
 * without touching callers.
 */
export class NativeIngestionAdapter implements KnowledgeIngestionPort {
  async normalize(document: IngestionDocument): Promise<IngestionNode[]> {
    const chunks = chunkText(document.text);

    return chunks.map((text, position) => ({
      text,
      position,
      metadata: {
        organizationId: document.metadata.organizationId,
        sourceId: document.metadata.sourceId,
        sourceVersion: document.metadata.sourceVersion,
        title: document.metadata.title,
        contentHash: computeContentHash(text),
      },
    }));
  }
}
