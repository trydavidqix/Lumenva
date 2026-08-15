import { afterEach, describe, expect, it, vi } from "vitest";

import { GraphitiClient, GraphitiProviderError } from "./graphiti-client";
import { graphGroupId } from "./namespace";
import type { GraphEpisode, GraphSearchInput } from "./types";

const apiKey = "synthetic-graphiti-api-key";
const organizationId = "11111111-1111-4111-8111-111111111111";
const groupId = graphGroupId(organizationId);

const episode: GraphEpisode = {
  organizationId,
  sourceId: "event-1",
  sourceVersion: "1",
  name: "whatsapp-message",
  body: "Cliente perguntou sobre prazo de entrega.",
  sourceType: "message",
  sourceDescription: "whatsapp inbound message",
  referenceTime: "2026-08-10T12:00:00Z",
};

const searchInput: GraphSearchInput = {
  organizationId,
  query: "prazo de entrega",
  limit: 5,
};

function client(timeoutMs = 50): GraphitiClient {
  return new GraphitiClient({
    baseUrl: "http://graphiti.internal/",
    apiKey,
    timeoutMs,
  });
}

function factResult(overrides: Record<string, unknown> = {}) {
  return {
    uuid: "fact-1",
    name: "prefers-express-delivery",
    fact: "Cliente prefere entrega expressa.",
    valid_at: "2026-08-10T12:00:00Z",
    invalid_at: null,
    created_at: "2026-08-10T12:00:00Z",
    expired_at: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("GraphitiClient", () => {
  describe("addEpisode", () => {
    it("sends the trusted group id derived from organizationId, never a caller-supplied one", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "queued", success: true }), { status: 202 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const smuggledEpisode = { ...episode, group_id: "org:attacker-controlled" } as unknown as GraphEpisode;
      await client().addEpisode(smuggledEpisode, "graph:event-1:1");

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://graphiti.internal/messages");
      expect(init.method).toBe("POST");
      const body = JSON.parse(String(init.body));
      expect(body.group_id).toBe(groupId);
      expect(body.group_id).not.toBe("org:attacker-controlled");
    });

    it("uses the idempotency key as the message uuid so retries upsert instead of duplicating", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "queued", success: true }), { status: 202 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await client().addEpisode(episode, "graph:event-1:1");

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(String(init.body));
      expect(body.messages).toEqual([
        {
          uuid: "graph:event-1:1",
          content: episode.body,
          name: episode.name,
          role_type: "system",
          role: null,
          timestamp: episode.referenceTime,
          source_description: episode.sourceDescription,
        },
      ]);
    });

    it("sends the api key header and never a bearer scheme", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "queued", success: true }), { status: 202 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await client().addEpisode(episode, "graph:event-1:1");

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.headers).toMatchObject({ "X-Api-Key": apiKey });
      expect(init.headers).not.toHaveProperty("Authorization");
    });

    it("rejects an invalid episode before making any request", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(client().addEpisode({ ...episode, body: "" }, "graph:event-1:1")).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects an empty idempotency key before making any request", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(client().addEpisode(episode, "")).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("normalizes an organizationId that is not a valid UUID into a typed configuration error", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        client().addEpisode({ ...episode, organizationId: "org-1" }, "graph:event-1:1"),
      ).rejects.toMatchObject({ kind: "configuration" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("blocks an episode whose body contains a secret-shaped string before making any request", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const secretEpisode = { ...episode, body: "OPENAI_API_KEY=should-not-be-persisted" };
      await expect(client().addEpisode(secretEpisode, "graph:event-1:1")).rejects.toMatchObject({
        kind: "sanitization",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("blocks an episode whose name or sourceDescription contains a secret-shaped string before making any request", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        client().addEpisode({ ...episode, name: "token=credential-value" }, "graph:event-1:1"),
      ).rejects.toMatchObject({ kind: "sanitization" });
      await expect(
        client().addEpisode(
          { ...episode, sourceDescription: "export using access_token=customer-provided-value" },
          "graph:event-1:1",
        ),
      ).rejects.toMatchObject({ kind: "sanitization" });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends a clean episode through unchanged", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "queued", success: true }), { status: 202 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await client().addEpisode(episode, "graph:event-1:1");

      expect(fetchMock).toHaveBeenCalledOnce();
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(String(init.body));
      expect(body.messages[0].content).toBe(episode.body);
    });

    it("throws when Graphiti reports ingestion failure in an otherwise well-formed response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ message: "rejected", success: false }), { status: 202 }),
        ),
      );

      await expect(client().addEpisode(episode, "graph:event-1:1")).rejects.toMatchObject({ kind: "http" });
    });
  });

  describe("search", () => {
    it("sends group_ids as a single-element array derived from organizationId only", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ facts: [] }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      await client().search(searchInput);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://graphiti.internal/search");
      const body = JSON.parse(String(init.body));
      expect(body).toEqual({ group_ids: [groupId], query: searchInput.query, max_facts: searchInput.limit });
    });

    it("cannot be made to search a second or raw group id through any input the method accepts", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ facts: [] }), { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      const smuggledInput = {
        ...searchInput,
        groupIds: ["org:attacker-controlled", groupId],
        group_id: "org:attacker-controlled",
      } as unknown as GraphSearchInput;
      await client().search(smuggledInput);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(String(init.body));
      expect(body.group_ids).toEqual([groupId]);
    });

    it("maps a well-formed fact conservatively: zero confidence, high risk, neutral authority domain", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ facts: [factResult()] }), { status: 200 })),
      );

      await expect(client().search(searchInput)).resolves.toEqual([
        {
          id: "fact-1",
          text: "Cliente prefere entrega expressa.",
          sourceId: "fact-1",
          validFrom: "2026-08-10T12:00:00.000Z",
          validUntil: null,
          confidence: 0,
          authorityDomain: "behavior",
          risk: "high",
        },
      ]);
    });

    it("resolves an empty array for a genuinely empty, well-formed result set", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ facts: [] }), { status: 200 })));

      await expect(client().search(searchInput)).resolves.toEqual([]);
    });

    it("rejects a search input with an empty query before making any request", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      await expect(client().search({ ...searchInput, query: "" })).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("degraded/invalid responses are never treated as trustworthy facts", () => {
    it("throws invalid_response for a malformed facts array instead of returning it, or any subset of it, as data", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ facts: [{ uuid: "fact-1" }] }), { status: 200 })),
      );

      const outcome = await client().search(searchInput).catch((error: unknown) => error);

      expect(outcome).toBeInstanceOf(GraphitiProviderError);
      expect(outcome).toMatchObject({ kind: "invalid_response" });
    });

    it("throws invalid_response for a top-level shape that is not the documented {facts:[...]} envelope", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200 })),
      );

      await expect(client().search(searchInput)).rejects.toMatchObject({ kind: "invalid_response" });
    });

    it("throws invalid_response, not invalid_response-as-empty, for an unparseable fact timestamp", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ facts: [factResult({ valid_at: "not-a-timestamp" })] }), { status: 200 }),
        ),
      );

      await expect(client().search(searchInput)).rejects.toMatchObject({ kind: "invalid_response" });
    });

    it("distinguishes an auth/http failure (kind http) from a malformed response (kind invalid_response)", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })));

      const authFailure = await client().search(searchInput).catch((error: unknown) => error);
      expect(authFailure).toMatchObject({ kind: "http" });

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ facts: "not-an-array" }), { status: 200 })),
      );
      const malformed = await client().search(searchInput).catch((error: unknown) => error);
      expect(malformed).toMatchObject({ kind: "invalid_response" });

      expect((authFailure as GraphitiProviderError).kind).not.toBe((malformed as GraphitiProviderError).kind);
    });
  });

  describe("deleteOrganization", () => {
    it("deletes only the trusted group derived from organizationId", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "deleted", success: true }), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await client().deleteOrganization(organizationId);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`http://graphiti.internal/group/${encodeURIComponent(groupId)}`);
      expect(init.method).toBe("DELETE");
    });

    it("throws when Graphiti reports a deletion failure", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "nope", success: false }), { status: 200 })),
      );

      await expect(client().deleteOrganization(organizationId)).rejects.toMatchObject({ kind: "http" });
    });
  });

  describe("health", () => {
    it("checks the documented healthcheck route and returns a measured status", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "healthy" }), { status: 200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const health = await client().health();

      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://graphiti.internal/healthcheck");
      expect(health.ok).toBe(true);
      expect(health.latencyMs).toEqual(expect.any(Number));
    });
  });

  describe("timeout and secret hygiene", () => {
    it("aborts a request at the configured timeout and exposes a typed error without the API key", async () => {
      vi.useFakeTimers();
      const fetchMock = vi.fn((_: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("request aborted", "AbortError")));
      }));
      vi.stubGlobal("fetch", fetchMock);

      const request = client(20).health().catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(20);

      const error = await request;
      expect(error).toBeInstanceOf(GraphitiProviderError);
      expect(error).toMatchObject({ kind: "timeout" });
      expect(String(error)).not.toContain(apiKey);
      expect(fetchMock.mock.calls[0]?.[1].signal?.aborted).toBe(true);
    });

    it("never echoes the API key in a thrown error for any failure kind", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 })));

      const httpError = await client().search(searchInput).catch((error: unknown) => error);
      expect(String(httpError)).not.toContain(apiKey);
      expect(JSON.stringify(httpError)).not.toContain(apiKey);

      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));
      const requestError = await client().search(searchInput).catch((error: unknown) => error);
      expect(requestError).toMatchObject({ kind: "request" });
      expect(String(requestError)).not.toContain(apiKey);
    });

    it("does not retry a failed synchronous search — exactly one fetch call per invocation", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response("service unavailable", { status: 503 }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(client().search(searchInput)).rejects.toMatchObject({ kind: "http" });
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  describe("configuration", () => {
    it("rejects an empty base URL, api key, or non-positive timeout", () => {
      expect(() => new GraphitiClient({ baseUrl: "", apiKey, timeoutMs: 50 })).toThrow(GraphitiProviderError);
      expect(() => new GraphitiClient({ baseUrl: "http://graphiti.internal", apiKey: "", timeoutMs: 50 })).toThrow(
        GraphitiProviderError,
      );
      expect(
        () => new GraphitiClient({ baseUrl: "http://graphiti.internal", apiKey, timeoutMs: 0 }),
      ).toThrow(GraphitiProviderError);
    });
  });
});
