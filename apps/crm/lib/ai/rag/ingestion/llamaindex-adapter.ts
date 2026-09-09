import { Document, MarkdownNodeParser, SentenceSplitter } from "llamaindex";

import { computeContentHash } from "@/lib/ai/rag/chunker";

import type { IngestionDocument, IngestionNode, KnowledgeIngestionPort } from "./port";

// Mirrors the native policy pipeline's ~400 token / ~50 token overlap budget
// (lib/ai/rag/ingest/policy.ts: 1600 chars / 200 chars at ~4 chars per token)
// so the two adapters are comparable in shadow mode rather than arbitrarily
// different granularities.
const DEFAULT_CHUNK_SIZE_TOKENS = 400;
const DEFAULT_CHUNK_OVERLAP_TOKENS = 50;

export interface LlamaIndexIngestionAdapterOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * LlamaIndex.TS OSS adapter for `KnowledgeIngestionPort`. Uses only local,
 * rule-based transformations — `MarkdownNodeParser` (splits on heading
 * boundaries via regex) and `SentenceSplitter` (sentence-aware size bounding
 * using the local cl100k_base tokenizer for token counting) — so chunking
 * plain Markdown never calls an LLM, an embedding endpoint, or LlamaCloud.
 * Returns normalized nodes only; indexing into pgvector remains the caller's
 * responsibility, same contract as `NativeIngestionAdapter`.
 */
export class LlamaIndexIngestionAdapter implements KnowledgeIngestionPort {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(options: LlamaIndexIngestionAdapterOptions = {}) {
    this.chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE_TOKENS;
    this.chunkOverlap = options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP_TOKENS;
  }

  async normalize(document: IngestionDocument): Promise<IngestionNode[]> {
    // Metadata is intentionally empty here: the splitter reserves token
    // budget for each node's own metadata string, and the canonical source
    // metadata (organizationId/sourceId/...) belongs on the resulting
    // IngestionNode, not on the intermediate LlamaIndex node.
    const source = new Document({ text: document.text, metadata: {} });
    const headingNodes = new MarkdownNodeParser().getNodesFromDocuments([source]);
    const splitter = new SentenceSplitter({
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap,
    });
    const sizedNodes = splitter.getNodesFromDocuments(headingNodes);

    const chunks = sizedNodes
      .map((node) => ({
        text: node.text.trim(),
        headerPath: headerPathFromMetadata(node.metadata),
      }))
      .filter((chunk) => chunk.text.length > 0);

    return chunks.map((chunk, position) => ({
      text: chunk.text,
      position,
      metadata: {
        organizationId: document.metadata.organizationId,
        sourceId: document.metadata.sourceId,
        sourceVersion: document.metadata.sourceVersion,
        title: document.metadata.title,
        contentHash: computeContentHash(chunk.text),
        headerPath: chunk.headerPath,
      },
    }));
  }
}

/** Joins MarkdownNodeParser's `Header_1`, `Header_2`, ... keys into "A > B". */
function headerPathFromMetadata(metadata: Record<string, unknown>): string {
  return Object.keys(metadata)
    .filter((key) => key.startsWith("Header_"))
    .sort()
    .map((key) => metadata[key])
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" > ");
}
