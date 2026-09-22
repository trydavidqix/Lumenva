import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CoreRuntime } from "./core-runtime.js";
import { startCoreHttpServer } from "./http-api.js";
import { SqliteStore } from "./sqlite-store.js";
import type { ExecutionResult } from "@lumenva/operating-core";

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
    expect(await health.json()).toEqual({ ok: true, state: "running", schemaVersion: 2 });

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

  it("keeps the graph endpoint available with an empty read-only fallback when Graphiti is OFF", async () => {
    const runtime = new CoreRuntime(new SqliteStore(join(mkdtempSync(join(tmpdir(), "lumenva-api-graph-off-")), "core.sqlite")));
    await runtime.start();
    const server = await startCoreHttpServer(runtime, 0);
    closers.push(async () => { await server.close(); await runtime.stop(); });

    const response = await fetch(`${server.url}/graph?namespace=project%3Alumenva&query=context&limit=10`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      readOnly: true,
      namespace: "project:lumenva",
      query: "context",
      nodes: [],
      edges: [],
    });
  });

  it("serves persisted execution evidence read-only", async () => {
    const runtime = new CoreRuntime(new SqliteStore(join(mkdtempSync(join(tmpdir(), "lumenva-api-execution-")), "core.sqlite")));
    await runtime.start();
    await runtime.startTask({ id: "task-exec", type: "agent.execute", idempotencyKey: "exec-1", traceId: "trace-exec", payload: {} });
    const result: ExecutionResult = {
      task_id: "task-exec",
      status: "success",
      summary: "probe",
      files_changed: [],
      commands: ["git status --short"],
      tests: [{ passed: true, report: "clean" }],
      evidence: ["evidence:probe"],
    };
    const record = await runtime.recordExecutionResult("task-exec", "codex", result);
    const server = await startCoreHttpServer(runtime, 0);
    closers.push(async () => { await server.close(); await runtime.stop(); });

    const response = await fetch(`${server.url}/executions/${encodeURIComponent(record.id)}`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ id: record.id, provider: "codex", result }));
    const list = await fetch(`${server.url}/executions`);
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toEqual({ executions: [expect.objectContaining({ id: record.id, provider: "codex" })] });
  });

  it("serves a read-only graph view with source drill-down metadata", async () => {
    const runtime = new CoreRuntime(new SqliteStore(join(mkdtempSync(join(tmpdir(), "lumenva-api-graph-")), "core.sqlite")));
    await runtime.start();
    const server = await startCoreHttpServer(runtime, 0, {
      graph: {
        search: async () => [{ id: "fact-1", text: "Fact", sourceId: "note-1", confidence: 0.9, validFrom: "2026-01-01", validUntil: null }],
      },
    });
    closers.push(async () => {
      await server.close();
      await runtime.stop();
    });

    const response = await fetch(`${server.url}/graph?namespace=project%3Alumenva&query=context&limit=10`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ readOnly: true, namespace: "project:lumenva", edges: [expect.objectContaining({ sourceId: "note-1", confidence: 0.9 })] }));
  });
});
