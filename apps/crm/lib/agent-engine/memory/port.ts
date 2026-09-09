import { z } from "zod";

import {
  memoryContactInputSchema,
  memorySearchInputSchema,
  semanticMemoryRecordSchema,
  type MemorySearchInput,
  type SemanticMemoryRecord,
} from "./types";

export interface MemoryPort {
  upsert(record: SemanticMemoryRecord, idempotencyKey: string): Promise<void>;
  search(input: MemorySearchInput): Promise<SemanticMemoryRecord[]>;
  deleteContact(input: { organizationId: string; contactId: string }): Promise<void>;
  health(): Promise<{ ok: boolean; latencyMs: number }>;
}

/**
 * Disabled adapter used when semantic memory is not configured. Its health is
 * deliberately a local marker: it does not represent an external provider.
 */
export class NullMemoryPort implements MemoryPort {
  async upsert(record: SemanticMemoryRecord, idempotencyKey: string): Promise<void> {
    semanticMemoryRecordSchema.parse(record);
    z.string().min(1).parse(idempotencyKey);
  }

  async search(input: MemorySearchInput): Promise<SemanticMemoryRecord[]> {
    memorySearchInputSchema.parse(input);
    return [];
  }

  async deleteContact(input: { organizationId: string; contactId: string }): Promise<void> {
    memoryContactInputSchema.parse(input);
  }

  async health(): Promise<{ ok: boolean; latencyMs: number }> {
    return { ok: true, latencyMs: 0 };
  }
}
