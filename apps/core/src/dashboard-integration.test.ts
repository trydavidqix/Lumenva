import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CoreRuntime } from "./core-runtime.js";
import { createLocalMgcAdapter } from "./mcg-adapter.js";
import { CoreTelemetrySink } from "./telemetry-sink.js";
import { SqliteStore } from "./sqlite-store.js";

// @ts-expect-error MCG is a JavaScript package consumed at the runtime boundary.
import { dashboardStats } from "../../../packages/maestri-context-gateway/src/dashboard.mjs";

describe("Core to dashboard telemetry", () => {
  it("makes Core context events visible to the existing MCG dashboard", async () => {
    const root = mkdtempSync(join(tmpdir(), "lumenva-dashboard-core-"));
    const runtime = new CoreRuntime(new SqliteStore(join(root, "core.sqlite")));
    const sink = new CoreTelemetrySink(root);
    sink.attach(runtime.events());

    await runtime.start();
    const task = await runtime.startTask({ id: "task-1", type: "task.start", idempotencyKey: "start-1", traceId: "trace-1", payload: {} });
    await runtime.requestContext(task.task.id, await createLocalMgcAdapter(), { objective: "Dashboard integration", budgetChars: 500 });
    const dashboard = await dashboardStats(root);
    await runtime.stop();
    rmSync(root, { recursive: true, force: true });

    expect(dashboard.telemetry.event_count).toBe(3);
    expect(dashboard.metrics.mcg_coverage).toBe(100);
    expect(dashboard.metrics.measurement_type).toBe("unavailable");
  });
});
