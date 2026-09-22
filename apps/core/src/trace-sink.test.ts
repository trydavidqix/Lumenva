import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CoreRuntime } from "./core-runtime.js";
import { createLocalMgcAdapter } from "./mcg-adapter.js";
import { McpGateway } from "./mcp-gateway.js";
import { SqliteStore } from "./sqlite-store.js";
import { CoreTraceSink } from "./trace-sink.js";
import { OtlpHttpExporter } from "./otlp-exporter.js";

describe("OTLP HTTP exporter", () => {
  it("sends a canonical OTLP JSON span with W3C-compatible ids", async () => {
    let request: { url: string; body: string; headers: Record<string, string> } | undefined;
    const exporter = new OtlpHttpExporter({
      endpoint: "http://127.0.0.1:4318/v1/traces",
      fetchImpl: async (url, init) => {
        request = { url, body: String(init.body), headers: init.headers };
        return { ok: true, status: 200 };
      },
    });

    await exporter.exportSpan({
      traceId: "trace-1",
      spanId: "span-1",
      name: "mcp.catalog",
      startTimeUnixNano: "1000",
      endTimeUnixNano: "2000",
      attributes: { task_id: "task-1", traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01" },
      status: "completed",
    });

    expect(request?.url).toBe("http://127.0.0.1:4318/v1/traces");
    expect(request?.headers["content-type"]).toBe("application/json");
    const body = JSON.parse(request!.body);
    const span = body.resourceSpans[0].scopeSpans[0].spans[0];
    expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(span.name).toBe("mcp.catalog");
    expect(span.status.code).toBe(1);
  });

  it("reports an unavailable exporter without an endpoint", async () => {
    const exporter = new OtlpHttpExporter({});
    await expect(exporter.exportSpan({ traceId: "trace", spanId: "span", name: "test", startTimeUnixNano: "1", endTimeUnixNano: "2", attributes: {}, status: "completed" }))
      .resolves.toEqual({ exported: false, reason: "endpoint_not_configured" });
  });
});

describe("Core trace sink", () => {
  it("exports the persisted span to OTLP without changing local trace storage", async () => {
    const root = mkdtempSync(join(tmpdir(), "lumenva-trace-otlp-"));
    const exported: string[] = [];
    const runtime = new CoreRuntime(new SqliteStore(join(root, "core.sqlite")));
    const sink = new CoreTraceSink(root, { otlpExporter: { exportSpan: async (span) => { exported.push(span.name); return { exported: true }; } } });
    sink.attach(runtime.events());
    await runtime.start();
    const task = await runtime.startTask({ id: "task-otlp", type: "task.start", idempotencyKey: "otlp-1", traceId: "trace-otlp", payload: {} });
    await runtime.events().publish({ id: "otlp-event", type: "context.completed", taskId: task.task.id, traceId: task.task.traceId, payload: { measurementType: "exact" } });
    await runtime.stop();

    expect(exported).toEqual(["context.completed"]);
    expect(sink.exportFailures()).toBe(0);
  });

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
    expect(rows).toContain('"traceparent":"00-0123456789abcdef0123456789abcdef-0123456789abcdef-01"');
    expect(rows).toContain('"status":"completed"');
  });
});
