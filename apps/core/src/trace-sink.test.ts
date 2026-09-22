import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CoreRuntime } from "./core-runtime.js";
import { createLocalMgcAdapter } from "./mcg-adapter.js";
import { McpGateway } from "./mcp-gateway.js";
import { SqliteStore } from "./sqlite-store.js";
import { CoreTraceSink } from "./trace-sink.js";

describe("Core trace sink", () => {
  it("persists MCP spans through the existing MCG trace store", async () => {
    const root = mkdtempSync(join(tmpdir(), "lumenva-trace-core-"));
    const runtime = new CoreRuntime(new SqliteStore(join(root, "core.sqlite")));
    const sink = new CoreTraceSink(root);
    sink.attach(runtime.events());
    const gateway = new McpGateway([{
      id: "github",
      version: "2026-07-28",
      listTools: async () => [],
      listResources: async () => [],
      health: async () => ({ ok: true, latencyMs: 1 }),
    }], { ttlMs: 1_000 });

    await runtime.start();
    const task = await runtime.startTask({ id: "task-1", type: "task.start", idempotencyKey: "start-1", traceId: "trace-1", payload: {} });
    await runtime.requestContext(task.task.id, await createLocalMgcAdapter(), {
      objective: "Trace MCP",
      budgetChars: 500,
      mcp: { gateway, serverId: "github", traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01" },
    });
    await runtime.stop();

    const files = readdirSync(join(root, "state", "telemetry", "traces"));
    const rows = readFileSync(join(root, "state", "telemetry", "traces", files[0]!), "utf8");
    expect(rows).toContain('"operation_type":"mcp.catalog"');
    expect(rows).toContain('"mcp_name":"github"');
    expect(rows).toContain('"status":"completed"');
  });
});
