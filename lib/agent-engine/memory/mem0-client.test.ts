import { afterEach, describe, expect, it, vi } from "vitest";

import { Mem0Client, Mem0ProviderError } from "./mem0-client";
import type { SemanticMemoryRecord } from "./types";

const apiKey = "***REMOVED***";

const record: SemanticMemoryRecord = {
  id: "memory-1",
  organizationId: "org-1",
  contactId: "contact-1",
  sourceId: "event-1",
  sourceVersion: "1",
  type: "preference",
  authorityDomain: "customer_preference",
  risk: "low",
  actionable: true,
  confidence: 0.9,
  validFrom: null,
  validUntil: null,
  text: "Prefere receber novidades por WhatsApp.",
};

function client(timeoutMs = 50): Mem0Client {
  return new Mem0Client({
    baseUrl: "http://mem0.internal/",
    apiKey,
    timeoutMs,
  });
}

function memoryResult(overrides: Record<string, unknown> = {}) {
  return {
    id: "mem0-memory-1",
    memory: record.text,
    metadata: {
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
      ...overrides,
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Mem0Client", () => {
  it("writes typed CRM memory to the OSS endpoint with an internal opaque contact namespace", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await client().upsert(record, "memory:event-1:1");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://mem0.internal/memories");
    expect(url).not.toContain("/v1/");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "Idempotency-Key": "memory:event-1:1",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      messages: [{ role: "user", content: record.text }],
      user_id: "org:org-1:contact:contact-1",
      infer: false,
      metadata: {
        memory_id: "memory-1",
        organization_id: "org-1",
        contact_id: "contact-1",
        source_id: "event-1",
        source_version: "1",
        type: "preference",
        authority_domain: "customer_preference",
        risk: "low",
        actionable: true,
        confidence: 0.9,
        valid_from: null,
        valid_until: null,
      },
    });
  });

  it("searches with the exact opaque user namespace and rejects a result outside its tenant/contact metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [memoryResult(), memoryResult({ contact_id: "contact-other" })],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(client().search({
      organizationId: "org-1",
      contactId: "contact-1",
      query: "preferência de contato",
      topK: 3,
    })).rejects.toMatchObject({ kind: "invalid_response" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://mem0.internal/search");
    expect(url).not.toContain("/v1/");
    expect(init.headers).toMatchObject({ "X-API-Key": apiKey });
    expect(JSON.parse(String(init.body))).toEqual({
      query: "preferência de contato",
      user_id: "org:org-1:contact:contact-1",
      limit: 3,
      filters: {
        user_id: "org:org-1:contact:contact-1",
        organization_id: "org-1",
        contact_id: "contact-1",
      },
    });
  });

  it("maps a complete scoped search response back to canonical memory records", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: [memoryResult()],
    }), { status: 200 })));

    await expect(client().search({
      organizationId: record.organizationId,
      contactId: record.contactId,
      query: "como falar com este contato?",
      topK: 1,
    })).resolves.toEqual([record]);
  });

  it("deletes only the internal namespace for the requested tenant contact", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "deleted" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await client().deleteContact({ organizationId: record.organizationId, contactId: record.contactId });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://mem0.internal/memories?user_id=org%3Aorg-1%3Acontact%3Acontact-1");
    expect(init.method).toBe("DELETE");
    expect(init.headers).toMatchObject({ "X-API-Key": apiKey });
    expect(init.body).toBeUndefined();
  });

  it("checks the OSS root endpoint and returns a measured healthy status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 })));

    const health = await client().health();

    expect(health.ok).toBe(true);
    expect(health.latencyMs).toEqual(expect.any(Number));
  });

  it("aborts a request at the configured timeout and exposes a typed error without the API key", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("request aborted", "AbortError")));
    }));
    vi.stubGlobal("fetch", fetchMock);

    const request = client(20).health().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(20);

    const error = await request;
    expect(error).toBeInstanceOf(Mem0ProviderError);
    expect(error).toMatchObject({ kind: "timeout" });
    expect(String(error)).not.toContain(apiKey);
    expect(fetchMock.mock.calls[0]?.[1].signal?.aborted).toBe(true);
  });

  it("rejects malformed provider responses without echoing the API key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{}] }), { status: 200 })));

    await expect(client().search({
      organizationId: record.organizationId,
      contactId: record.contactId,
      query: "preferência",
      topK: 1,
    })).rejects.toMatchObject({ kind: "invalid_response" });
    await expect(client().search({
      organizationId: record.organizationId,
      contactId: record.contactId,
      query: "preferência",
      topK: 1,
    })).rejects.not.toThrow(apiKey);
  });
});
