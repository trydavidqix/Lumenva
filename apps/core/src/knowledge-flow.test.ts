import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CoreRuntime } from "./core-runtime.js";
import { SqliteStore } from "./sqlite-store.js";

describe("Core knowledge flow", () => {
  it("publishes a validated Obsidian note and projects it to the graph", async () => {
    const core = new CoreRuntime(new SqliteStore(join(mkdtempSync(join(tmpdir(), "lumenva-knowledge-flow-")), "core.sqlite")));
    await core.start();
    const task = await core.startTask({ id: "task-1", type: "knowledge.publish", idempotencyKey: "knowledge-1", traceId: "trace-1", payload: {} });
    const episodes: unknown[] = [];
    const graph = { addEpisode: async (episode: unknown) => { episodes.push(episode); } };

    const result = await core.publishKnowledge(task.task.id, graph, {
      namespace: "project:lumenva",
      sourcePath: "vault/Doctrine.md",
      markdown: "---\nstatus: PUBLISHED\ntitle: Doctrine\nsource_id: doctrine-1\nversion: 2\npublished_at: 2026-09-22T10:00:00.000Z\n---\nUse bounded context.",
    });

    expect(result).toEqual({ sourceId: "doctrine-1", version: 2, idempotencyKey: "project:lumenva:doctrine-1:v2" });
    expect(episodes).toEqual([expect.objectContaining({ sourceId: "doctrine-1", sourceVersion: "2", namespace: "project:lumenva" })]);
    expect(core.eventsList().map((event) => event.type)).toEqual(["task.created", "knowledge.published", "graph.projected"]);
    expect(core.eventsList()[1]?.payload).toEqual(expect.objectContaining({ sourceId: "doctrine-1", sourcePath: "vault/Doctrine.md", measurementType: "exact" }));
    await core.stop();
  });
});
