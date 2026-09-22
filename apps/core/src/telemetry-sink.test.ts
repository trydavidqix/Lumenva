import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CoreRuntime } from "./core-runtime.js";
import { createLocalMgcAdapter } from "./mcg-adapter.js";
import { CoreTelemetrySink } from "./telemetry-sink.js";
import { SqliteStore } from "./sqlite-store.js";

describe("CoreTelemetrySink", () => {
  it("writes Core events into the MCG telemetry contract", async () => {
    const mcgRoot = mkdtempSync(join(tmpdir(), "lumenva-telemetry-"));
    const runtime = new CoreRuntime(new SqliteStore(join(mkdtempSync(join(tmpdir(), "lumenva-telemetry-db-")), "core.sqlite")));
    const sink = new CoreTelemetrySink(mcgRoot);
    sink.attach(runtime.events());
    await runtime.start();
    const task = await runtime.startTask({ id: "task-1", type: "task.start", idempotencyKey: "start-1", traceId: "trace-1", payload: {} });
    await runtime.requestContext(task.task.id, await createLocalMgcAdapter(), { objective: "Index knowledge", budgetChars: 500 });
    await runtime.stop();

    const rows = readFileSync(join(mcgRoot, "state", "telemetry", "events.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(rows.map((row) => row.operation)).toContain("task.created");
    expect(rows.map((row) => row.operation)).toContain("context.compile");
    expect(rows.find((row) => row.operation === "context.compile")).toEqual(expect.objectContaining({ task_id: "task-1", source: "core.mcg", measurement_type: "estimated" }));
  });
});
