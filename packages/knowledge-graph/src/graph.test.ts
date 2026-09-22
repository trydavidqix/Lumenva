import { describe, expect, it } from "vitest";
import { createProjectNamespace, NullKnowledgeGraph } from "./index.js";

describe("knowledge graph contract", () => {
  it("creates a deterministic project namespace", () => {
    expect(createProjectNamespace(" Lumenva Command Center ")).toBe("project:lumenva-command-center");
  });

  it("degrades safely when the graph provider is unavailable", async () => {
    const graph = new NullKnowledgeGraph();
    await expect(graph.search({ namespace: "project:lumenva", query: "context", limit: 5 })).resolves.toEqual([]);
    await expect(graph.health()).resolves.toEqual({ ok: false, latencyMs: 0 });
  });
});
