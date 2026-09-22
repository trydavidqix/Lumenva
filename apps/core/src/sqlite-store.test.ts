import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SqliteStore } from "./sqlite-store.js";
import type { ExecutionResult } from "@lumenva/operating-core";

describe("SqliteStore", () => {
  it("persists migrations, idempotent tasks, and ordered events across restart", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "lumenva-core-")), "core.sqlite");
    const first = new SqliteStore(dbPath);
    first.open();

    expect(first.schemaVersion()).toBe(2);
    const task = first.createTask({
      id: "task-1",
      type: "task.start",
      idempotencyKey: "start-1",
      traceId: "trace-1",
      payload: { goal: "index knowledge" },
    });
    expect(first.createTask({
      id: "task-duplicate",
      type: "task.start",
      idempotencyKey: "start-1",
      traceId: "trace-2",
      payload: { goal: "duplicate" },
    })).toEqual(task);
    first.appendEvent({ id: "event-1", type: "task.created", taskId: task.id, traceId: task.traceId, payload: { status: "queued" } });
    first.appendEvent({ id: "event-2", type: "agent.started", taskId: task.id, traceId: task.traceId, payload: { provider: "codex" } });
    first.close();

    const second = new SqliteStore(dbPath);
    second.open();
    expect(second.getTask("task-1")).toEqual(task);
    expect(second.replayEvents()).toEqual([
      expect.objectContaining({ sequence: 1, id: "event-1", type: "task.created" }),
      expect.objectContaining({ sequence: 2, id: "event-2", type: "agent.started" }),
    ]);
    second.close();
  });

  it("persists an execution result and evidence across restart", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "lumenva-execution-")), "core.sqlite");
    const first = new SqliteStore(dbPath);
    first.open();
    first.createTask({ id: "task-execution", type: "agent.execute", idempotencyKey: "exec-1", traceId: "trace-exec", payload: {} });
    const result: ExecutionResult = {
      task_id: "task-execution",
      status: "success",
      summary: "read-only probe",
      files_changed: [],
      commands: ["git status --short"],
      tests: [{ passed: true, report: "clean" }],
      evidence: ["evidence:codex-probe"],
    };

    first.recordExecution({ id: "execution-1", taskId: "task-execution", traceId: "trace-exec", provider: "codex", result });
    first.close();

    const second = new SqliteStore(dbPath);
    second.open();
    expect(second.getExecution("execution-1")).toEqual(expect.objectContaining({
      id: "execution-1",
      provider: "codex",
      result,
    }));
    second.close();
  });
});
