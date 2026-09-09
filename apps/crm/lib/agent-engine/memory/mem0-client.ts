import { z } from "zod";

import type { MemoryPort } from "./port";
import {
  memoryContactInputSchema,
  memorySearchInputSchema,
  semanticMemoryRecordSchema,
  type MemorySearchInput,
  type SemanticMemoryRecord,
} from "./types";

export interface Mem0ClientConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

type Mem0ProviderErrorKind = "configuration" | "http" | "invalid_response" | "request" | "timeout";

export class Mem0ProviderError extends Error {
  constructor(readonly kind: Mem0ProviderErrorKind, message: string) {
    super(message);
    this.name = "Mem0ProviderError";
  }
}

const providerRecordSchema = z.object({
  id: z.string().min(1),
  memory: z.string().min(1),
  metadata: z.object({
    memory_id: z.string().min(1),
    organization_id: z.string().min(1),
    contact_id: z.string().min(1),
    source_id: z.string().min(1),
    source_version: z.string().min(1),
    type: z.string().min(1),
    authority_domain: z.string().min(1),
    risk: z.string().min(1),
    actionable: z.boolean(),
    confidence: z.number().finite(),
    valid_from: z.string().nullable(),
    valid_until: z.string().nullable(),
  }),
});

const searchResponseSchema = z.object({ results: z.array(providerRecordSchema) });
const writeResponseSchema = z.object({ results: z.array(z.unknown()) });
const deleteResponseSchema = z.object({ message: z.string().min(1) });

function namespaceFor(organizationId: string, contactId: string): string {
  return `org:${organizationId}:contact:${contactId}`;
}

function metadataFor(record: SemanticMemoryRecord) {
  return {
    memory_id: record.id,
    organization_id: record.organizationId,
    contact_id: record.contactId,
    source_id: record.sourceId,
    source_version: record.sourceVersion,
    type: record.type,
    authority_domain: record.authorityDomain,
    risk: record.risk,
    actionable: record.actionable,
    confidence: record.confidence,
    valid_from: record.validFrom,
    valid_until: record.validUntil,
  };
}

export class Mem0Client implements MemoryPort {
  private readonly baseUrl: string;

  constructor(private readonly config: Mem0ClientConfig) {
    if (!config.baseUrl || !config.apiKey || !Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0) {
      throw new Mem0ProviderError("configuration", "Mem0 configuration is invalid");
    }

    try {
      this.baseUrl = new URL(config.baseUrl).toString().replace(/\/$/, "");
    } catch {
      throw new Mem0ProviderError("configuration", "Mem0 configuration is invalid");
    }
  }

  async upsert(record: SemanticMemoryRecord, idempotencyKey: string): Promise<void> {
    const parsedRecord = semanticMemoryRecordSchema.parse(record);
    z.string().min(1).parse(idempotencyKey);

    const response = await this.request("/memories", "POST", {
      messages: [{ role: "user", content: parsedRecord.text }],
      user_id: namespaceFor(parsedRecord.organizationId, parsedRecord.contactId),
      infer: false,
      metadata: metadataFor(parsedRecord),
    }, idempotencyKey);
    this.parseResponse(writeResponseSchema, response);
  }

  async search(input: MemorySearchInput): Promise<SemanticMemoryRecord[]> {
    const parsedInput = memorySearchInputSchema.parse(input);
    const userId = namespaceFor(parsedInput.organizationId, parsedInput.contactId);
    const response = await this.request("/search", "POST", {
      query: parsedInput.query,
      user_id: userId,
      limit: parsedInput.topK,
      filters: {
        user_id: userId,
        organization_id: parsedInput.organizationId,
        contact_id: parsedInput.contactId,
      },
    });
    const parsedResponse = this.parseResponse(searchResponseSchema, response);

    return parsedResponse.results.map((result) => {
      if (
        result.metadata.organization_id !== parsedInput.organizationId
        || result.metadata.contact_id !== parsedInput.contactId
      ) {
        throw new Mem0ProviderError("invalid_response", "Mem0 returned a result outside the requested scope");
      }

      try {
        return semanticMemoryRecordSchema.parse({
          id: result.metadata.memory_id,
          organizationId: result.metadata.organization_id,
          contactId: result.metadata.contact_id,
          sourceId: result.metadata.source_id,
          sourceVersion: result.metadata.source_version,
          type: result.metadata.type,
          authorityDomain: result.metadata.authority_domain,
          risk: result.metadata.risk,
          actionable: result.metadata.actionable,
          confidence: result.metadata.confidence,
          validFrom: result.metadata.valid_from,
          validUntil: result.metadata.valid_until,
          text: result.memory,
        });
      } catch {
        throw new Mem0ProviderError("invalid_response", "Mem0 returned an invalid memory record");
      }
    });
  }

  async deleteContact(input: { organizationId: string; contactId: string }): Promise<void> {
    const parsedInput = memoryContactInputSchema.parse(input);
    const userId = namespaceFor(parsedInput.organizationId, parsedInput.contactId);
    // Mem0's DELETE /memories reads user_id/run_id/agent_id as query params
    // (FastAPI function params), not a JSON body — a body-only request 400s
    // with "At least one identifier is required." even with a valid payload.
    const response = await this.request(
      `/memories?user_id=${encodeURIComponent(userId)}`,
      "DELETE",
    );
    this.parseResponse(deleteResponseSchema, response);
  }

  async health(): Promise<{ ok: boolean; latencyMs: number }> {
    const startedAt = Date.now();
    await this.request("/", "GET");
    return { ok: true, latencyMs: Date.now() - startedAt };
  }

  private async request(
    path: string,
    method: "DELETE" | "GET" | "POST",
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.config.apiKey,
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Mem0ProviderError("http", `Mem0 request failed with status ${response.status}`);
      }

      try {
        return await response.json();
      } catch {
        throw new Mem0ProviderError("invalid_response", "Mem0 returned an invalid JSON response");
      }
    } catch (error) {
      if (error instanceof Mem0ProviderError) throw error;
      if (timedOut || controller.signal.aborted) {
        throw new Mem0ProviderError("timeout", "Mem0 request timed out");
      }
      throw new Mem0ProviderError("request", "Mem0 request failed");
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseResponse<T>(schema: z.ZodType<T>, response: unknown): T {
    const parsed = schema.safeParse(response);
    if (!parsed.success) {
      throw new Mem0ProviderError("invalid_response", "Mem0 returned an unexpected response");
    }
    return parsed.data;
  }
}
