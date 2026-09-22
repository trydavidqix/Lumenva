import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CoreRuntime } from "./core-runtime.js";
import { SqliteStore } from "./sqlite-store.js";

describe("CoreRuntime", () => {
  it("recovers non-terminal tasks after restart and reports health", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "lumenva-runtime-")), "core.sqlite");
    const initialStore = new SqliteStore(dbPath);
    initialStore.open();
    initialStore.createTask({ id: "task-1", type: "task.start", idempotencyKey: "start-1", traceId: "trace-1", payload: {} });
    initialStore.close();

    const runtime = new CoreRuntime(new SqliteStore(dbPath));
    const recovered: string[] = [];
    runtime.events().subscribe((event) => recovered.push(event.type));
    await runtime.start();

    expect(runtime.health()).toEqual({ ok: true, state: "running", schemaVersion: 1 });
    expect(runtime.task("task-1")?.status).toBe("RECOVERING");
    expect(recovered).toEqual(["core.recovered"]);

    await runtime.stop();
    expect(runtime.health()).toEqual({ ok: false, state: "stopped", schemaVersion: 0 });
  });
});
