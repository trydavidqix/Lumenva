import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CoreRuntime } from "./core-runtime.js";
import { SqliteStore } from "./sqlite-store.js";
import type { ExecutionResult, TaskContract as FabricTaskContract } from "@lumenva/operating-core";
import { createHandoffRequest } from "@lumenva/operating-core";

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

    expect(runtime.health()).toEqual({ ok: true, state: "running", schemaVersion: 2 });
    expect(runtime.task("task-1")?.status).toBe("RECOVERING");
    expect(recovered).toEqual(["core.recovered"]);

    await runtime.stop();
    expect(runtime.health()).toEqual({ ok: false, state: "stopped", schemaVersion: 0 });
  });

  it("records provider execution results in the durable runtime event log", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "lumenva-runtime-execution-")), "core.sqlite");
    const runtime = new CoreRuntime(new SqliteStore(dbPath));
    await runtime.start();
    await runtime.startTask({ id: "task-exec", type: "agent.execute", idempotencyKey: "exec-idem", traceId: "trace-exec", payload: {} });
    const result: ExecutionResult = {
      task_id: "task-exec",
      status: "success",
      summary: "Codex probe completed",
      files_changed: [],
      commands: ["git status --short"],
      tests: [{ passed: true, report: "clean" }],
      evidence: ["evidence:codex-probe"],
    };

    const record = await runtime.recordExecutionResult("task-exec", "codex", result);

    expect(record.result).toEqual(result);
    expect(runtime.execution(record.id)?.provider).toBe("codex");
    expect(runtime.eventsList()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "execution.recorded", taskId: "task-exec" }),
    ]));
    await runtime.stop();
  });

  it("runs a Maestri delegation and persists the provider result", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "lumenva-runtime-delegation-")), "core.sqlite");
    const runtime = new CoreRuntime(new SqliteStore(dbPath));
    await runtime.start();
    await runtime.startTask({ id: "task-delegate", type: "agent.execute", idempotencyKey: "delegate-idem", traceId: "trace-delegate", payload: {} });
    const result: ExecutionResult = {
      task_id: "task-delegate", status: "success", summary: "delegated", files_changed: [], commands: [], tests: [], evidence: ["evidence:delegated"],
    };
    const fabricContract: FabricTaskContract = {
      task_id: "task-delegate", goal: "delegated", scope: "read-only", allowed_paths: [], constraints: [], capabilities: ["read_only"],
      risk: "low", base_sha: "abc123", context_budget: { input_tokens: 1000 }, tool_budget: { calls: 1 }, execution_budget: { seconds: 30 },
      preferred_provider: "codex", evidence_required: [],
    };
    const delegator = {
      delegate: async () => ({
        target: { provider: "codex" as const }, context: undefined, result, digest: {
          task_id: "task-delegate", status: "success" as const, summary: "delegated", changed: [], tests: [], important_decisions: [], risk: "low", evidence: ["evidence:delegated"],
        },
      }),
    };

    const delegated = await runtime.delegateTask("task-delegate", delegator, {
      request: createHandoffRequest({ task_id: "task-delegate", trace_id: "trace-delegate", from_agent: "claude", to_agent: "codex", goal: "delegated" }),
      contract: fabricContract,
    });

    expect(delegated.result).toEqual(result);
    expect(runtime.executions()).toHaveLength(1);
    expect(runtime.executions()[0]?.provider).toBe("codex");
    await runtime.stop();
  });
});
