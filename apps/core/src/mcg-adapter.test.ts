import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CoreRuntime } from "./core-runtime.js";
import { createLocalMgcAdapter, type MgcAdapter } from "./mcg-adapter.js";
import { SqliteStore } from "./sqlite-store.js";

function runtime() {
  return new CoreRuntime(new SqliteStore(join(mkdtempSync(join(tmpdir(), "lumenva-mcg-")), "core.sqlite")));
}

describe("CoreRuntime MCG boundary", () => {
  it("uses the existing MCG compiler through the standalone adapter", async () => {
    const adapter = await createLocalMgcAdapter();
    const result = await adapter.compile({ taskId: "task-1", traceId: "trace-1", objective: "Index knowledge", budgetChars: 500 });

    expect(result.contextVersion).toMatch(/^v[0-9a-f]{12}$/);
    expect(result.fragments).toEqual([expect.objectContaining({ id: "task-1:objective", content: "Index knowledge" })]);
    expect(result.source).toBe("context.compiler");
  });

  it("records context request/completion and preserves MCG provenance", async () => {
    const core = runtime();
    await core.start();
    const task = await core.startTask({ id: "task-1", type: "task.start", idempotencyKey: "start-1", traceId: "trace-1", payload: {} });
    const adapter: MgcAdapter = {
      compile: async () => ({ contextVersion: "v-context-1", fragments: [{ id: "objective", content: "Index knowledge" }], measurementType: "estimated", source: "context.compiler" }),
    };

    const result = await core.requestContext(task.task.id, adapter, { objective: "Index knowledge", budgetChars: 500 });

    expect(result).toEqual({ contextVersion: "v-context-1", fragments: [{ id: "objective", content: "Index knowledge" }], measurementType: "estimated", source: "context.compiler" });
    expect(core.eventsList().map((event) => event.type)).toEqual(["task.created", "context.requested", "context.completed"]);
    expect(core.eventsList()[2]?.payload).toEqual(expect.objectContaining({ contextVersion: "v-context-1", measurementType: "estimated", source: "context.compiler", inputChars: 15, outputChars: 15 }));
    await core.stop();
  });

  it("returns typed MCG_UNAVAILABLE and no fake context when the adapter fails", async () => {
    const core = runtime();
    await core.start();
    const task = await core.startTask({ id: "task-1", type: "task.start", idempotencyKey: "start-1", traceId: "trace-1", payload: {} });
    const adapter: MgcAdapter = { compile: async () => { throw new Error("daemon offline"); } };

    await expect(core.requestContext(task.task.id, adapter, { objective: "Index knowledge", budgetChars: 500 }))
      .rejects.toMatchObject({ code: "MCG_UNAVAILABLE" });
    expect(core.eventsList().map((event) => event.type)).toEqual(["task.created", "context.requested", "context.failed"]);
    expect(core.eventsList()[2]?.payload).toEqual({ code: "MCG_UNAVAILABLE", measurementType: "unavailable" });
    await core.stop();
  });
});
