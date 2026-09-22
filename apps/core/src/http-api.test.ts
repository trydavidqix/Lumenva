import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CoreRuntime } from "./core-runtime.js";
import { startCoreHttpServer } from "./http-api.js";
import { SqliteStore } from "./sqlite-store.js";

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (closers.length) await closers.pop()?.();
});

describe("Core HTTP API", () => {
  it("serves loopback health, idempotent task start, task get, and event replay", async () => {
    const runtime = new CoreRuntime(new SqliteStore(join(mkdtempSync(join(tmpdir(), "lumenva-api-")), "core.sqlite")));
    await runtime.start();
    const server = await startCoreHttpServer(runtime, 0);
    closers.push(async () => {
      await server.close();
      await runtime.stop();
    });

    const health = await fetch(`${server.url}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true, state: "running", schemaVersion: 1 });

    const created = await fetch(`${server.url}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "task-1", type: "task.start", idempotencyKey: "start-1", traceId: "trace-1", payload: { goal: "index" } }),
    });
    expect(created.status).toBe(201);
    expect((await created.json()).id).toBe("task-1");

    const duplicate = await fetch(`${server.url}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "task-duplicate", type: "task.start", idempotencyKey: "start-1", traceId: "trace-2", payload: {} }),
    });
    expect(duplicate.status).toBe(200);
    expect((await duplicate.json()).id).toBe("task-1");

    expect((await (await fetch(`${server.url}/tasks/task-1`)).json()).status).toBe("QUEUED");
    expect((await (await fetch(`${server.url}/events`)).json()).events).toHaveLength(1);
  });
});
