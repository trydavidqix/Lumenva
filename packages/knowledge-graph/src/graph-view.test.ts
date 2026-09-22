import { describe, expect, it } from "vitest";
import { buildGraphView } from "./graph-view.js";
import type { KnowledgeGraph } from "./graph.js";

describe("read-only Graph View", () => {
  it("projects facts into deterministic fact/source nodes with drill-down metadata", async () => {
    const graph: KnowledgeGraph = {
      addEpisode: async () => { throw new Error("read-only view must not write"); },
      search: async () => [
        { id: "fact-2", text: "Second", sourceId: "note-b", confidence: 0.7, validFrom: "2026-01-02", validUntil: null },
        { id: "fact-1", text: "First", sourceId: "note-a", confidence: 0.9, validFrom: "2026-01-01", validUntil: "2026-01-10" },
      ],
      health: async () => ({ ok: true, latencyMs: 1 }),
    };

    const view = await buildGraphView(graph, { namespace: "project:lumenva", query: "context", limit: 10 });

    expect(view.readOnly).toBe(true);
    expect(view.nodes.map((node) => node.id)).toEqual(["fact:fact-1", "source:note-a", "fact:fact-2", "source:note-b"]);
    expect(view.edges).toEqual([
      { id: "edge:fact-1:note-a", source: "fact:fact-1", target: "source:note-a", confidence: 0.9, validFrom: "2026-01-01", validUntil: "2026-01-10", sourceId: "note-a" },
      { id: "edge:fact-2:note-b", source: "fact:fact-2", target: "source:note-b", confidence: 0.7, validFrom: "2026-01-02", validUntil: null, sourceId: "note-b" },
    ]);
  });
});
