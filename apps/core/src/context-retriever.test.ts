import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KnowledgeContextRetriever } from "./context-retriever.js";

describe("KnowledgeContextRetriever", () => {
  it("retrieves only published, clean Obsidian notes and Graphiti facts", async () => {
    const root = await mkdtemp(join(tmpdir(), "lumenva-context-retriever-"));
    await mkdir(join(root, "notes"), { recursive: true });
    await writeFile(join(root, "notes", "published.md"), "---\nstatus: PUBLISHED\ntitle: Context\nsource_id: note-1\nversion: 1\npublished_at: 2026-01-01T00:00:00.000Z\n---\nUse the bounded context engine.");
    await writeFile(join(root, "notes", "draft.md"), "---\nstatus: DRAFT\ntitle: Draft\nsource_id: draft-1\nversion: 1\npublished_at: 2026-01-01T00:00:00.000Z\n---\nDo not retrieve.");
    await writeFile(join(root, "notes", "secret.md"), "---\nstatus: PUBLISHED\ntitle: Secret\nsource_id: secret-1\nversion: 1\npublished_at: 2026-01-01T00:00:00.000Z\n---\napi_key: sk-test-secret-value-1234567890");

    const retriever = new KnowledgeContextRetriever({
      root,
      knowledgePath: "notes",
      graph: { search: async () => [{ id: "fact-1", text: "Context budgets are bounded", sourceId: "graph-note", confidence: 0.9, validFrom: null, validUntil: null }] },
      namespace: "project:lumenva",
    });
    const candidates = await retriever.symbols({ goal: "context budgets", allowedPaths: ["notes"] });

    expect(candidates.map(candidate => candidate.path).sort()).toEqual(["graph:fact-1", "notes/published.md"]);
    expect(candidates.find(candidate => candidate.path === "graph:fact-1")?.content).toContain("Context budgets");
    expect(candidates.find(candidate => candidate.path === "notes/published.md")?.content).toContain("bounded context");
  });

  it("returns deterministic bounded candidates for excerpt expansion", async () => {
    const root = await mkdtemp(join(tmpdir(), "lumenva-context-retriever-"));
    await mkdir(join(root, "notes"), { recursive: true });
    await writeFile(join(root, "notes", "one.md"), "---\nstatus: PUBLISHED\ntitle: One\nsource_id: one\nversion: 1\npublished_at: 2026-01-01T00:00:00.000Z\n---\nOne note.");
    const retriever = new KnowledgeContextRetriever({ root, knowledgePath: "notes" });
    const candidates = await retriever.symbols({ goal: "note", allowedPaths: ["notes"] });
    const excerpts = await retriever.excerpts({ goal: "note", allowedPaths: ["notes"] }, candidates);

    expect(excerpts).toEqual(candidates);
    expect(excerpts[0]?.path).toBe("notes/one.md");
  });
});
