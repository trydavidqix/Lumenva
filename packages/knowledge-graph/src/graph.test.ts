import { describe, expect, it } from "vitest";
import { createProjectNamespace, GraphitiHttpClient, NullKnowledgeGraph, projectPublishedNote } from "./index.js";

describe("knowledge graph contract", () => {
  it("creates a deterministic project namespace", () => {
    expect(createProjectNamespace(" Lumenva Command Center ")).toBe("project:lumenva-command-center");
  });

  it("degrades safely when the graph provider is unavailable", async () => {
    const graph = new NullKnowledgeGraph();
    await expect(graph.search({ namespace: "project:lumenva", query: "context", limit: 5 })).resolves.toEqual([]);
    await expect(graph.health()).resolves.toEqual({ ok: false, latencyMs: 0 });
  });

  it("projects a published note with deterministic idempotency and provenance", async () => {
    const episodes: unknown[] = [];
    const graph = {
      addEpisode: async (episode: unknown) => {
        episodes.push(episode);
      },
    };

    const result = await projectPublishedNote(graph, {
      namespace: "project:lumenva",
      title: "Doctrine",
      sourceId: "doctrine-1",
      version: 3,
      publishedAt: "2026-09-22T10:00:00.000Z",
      body: "Use bounded context.",
      provenance: {
        sourceType: "obsidian",
        sourcePath: "vault/Doctrine.md",
        sourceId: "doctrine-1",
        version: 3,
      },
    });

    expect(result).toBe("project:lumenva:doctrine-1:v3");
    expect(episodes).toEqual([
      {
        namespace: "project:lumenva",
        sourceId: "doctrine-1",
        sourceVersion: "3",
        title: "Doctrine",
        body: "Use bounded context.",
        referenceTime: "2026-09-22T10:00:00.000Z",
        provenance: { sourcePath: "vault/Doctrine.md", sourceType: "obsidian" },
        idempotencyKey: "project:lumenva:doctrine-1:v3",
      },
    ]);
  });

  it("sends a projected episode through the Graphiti HTTP contract", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = new GraphitiHttpClient({
      baseUrl: "http://graphiti.test/",
      apiKey: "local-test-key",
      timeoutMs: 1000,
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return { ok: true, status: 202, json: async () => ({ message: "queued", success: true }) };
      },
    });

    await client.addEpisode({
      namespace: "project:lumenva",
      sourceId: "doctrine-1",
      sourceVersion: "3",
      title: "Doctrine",
      body: "Use bounded context.",
      referenceTime: "2026-09-22T10:00:00.000Z",
      provenance: { sourcePath: "vault/Doctrine.md", sourceType: "obsidian" },
      idempotencyKey: "project:lumenva:doctrine-1:v3",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://graphiti.test/messages");
    expect(calls[0]?.init.headers).toEqual({
      "Content-Type": "application/json",
      "X-Api-Key": "local-test-key",
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      group_id: "project:lumenva",
      messages: [{
        uuid: "project:lumenva:doctrine-1:v3",
        content: "Use bounded context.",
        name: "Doctrine",
        role_type: "system",
        role: null,
        timestamp: "2026-09-22T10:00:00.000Z",
        source_description: "vault/Doctrine.md",
      }],
    });
  });
});
