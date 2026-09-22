import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CoreRuntime } from "./core-runtime.js";
import type { BudgetLimits } from "./context-budget.js";
import { resolveContext, type ContextPacket, type TaskContract } from "./context-engine.js";
import { createLocalMgcAdapter, type MgcAdapter } from "./mcg-adapter.js";
import { McpGateway } from "./mcp-gateway.js";
import { SqliteStore } from "./sqlite-store.js";

function runtime() {
  return new CoreRuntime(new SqliteStore(join(mkdtempSync(join(tmpdir(), "lumenva-mcg-")), "core.sqlite")));
}

function packet(): ContextPacket {
  const task: TaskContract = {
    taskId: "task-1",
    goal: "Index knowledge",
    scope: "packages",
    allowedPaths: ["packages"],
    constraints: [],
    capabilities: ["read_file"],
    risk: "low",
    baseSha: "abc123",
    contextBudget: 500,
    toolBudget: 2,
    executionBudget: 1_000,
    preferredProvider: "codex",
    evidenceRequired: true,
  };
  return resolveContext({
    task,
    candidates: [{ path: "packages/knowledge/src/index.ts", symbols: ["publish"], content: "export function publish() {}", score: 1 }],
    level: 2,
  });
}

describe("CoreRuntime MCG boundary", () => {
  it("uses the existing MCG compiler through the standalone adapter", async () => {
    const adapter = await createLocalMgcAdapter();
    const result = await adapter.compile({ taskId: "task-1", traceId: "trace-1", objective: "Index knowledge", budgetChars: 500 });

    expect(result.contextVersion).toMatch(/^v[0-9a-f]{12}$/);
    expect(result.fragments).toEqual([expect.objectContaining({ id: "task-1:objective", content: "Index knowledge" })]);
    expect(result.source).toBe("context.compiler");
  });

  it("passes a resolved packet through the Core and compiles its excerpts locally", async () => {
    const resolved = packet();
    const adapter = await createLocalMgcAdapter();
    const result = await adapter.compile({ taskId: "task-1", traceId: "trace-1", objective: resolved.objective, budgetChars: 500, packet: resolved });

    expect(result.fragments).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "task-1:objective", content: "Index knowledge" }),
      expect.objectContaining({ id: "packages/knowledge/src/index.ts", content: "export function publish() {}" }),
    ]));

    const core = runtime();
    await core.start();
    const task = await core.startTask({ id: "task-1", type: "task.start", idempotencyKey: "start-1", traceId: "trace-1", payload: {} });
    let received: ContextPacket | undefined;
    const observingAdapter: MgcAdapter = {
      compile: async (request) => {
        received = request.packet;
        return { contextVersion: "v-context-1", fragments: [], measurementType: "estimated", source: "context.compiler" };
      },
    };
    await core.requestContext(task.task.id, observingAdapter, { objective: resolved.objective, budgetChars: 500, packet: resolved });
    expect(received).toEqual(resolved);
    await core.stop();
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

  it("fails closed before the adapter when the context budget is exceeded", async () => {
    const core = runtime();
    await core.start();
    const task = await core.startTask({ id: "task-1", type: "task.start", idempotencyKey: "start-1", traceId: "trace-1", payload: {} });
    let called = false;
    const adapter: MgcAdapter = {
      compile: async () => {
        called = true;
        return { contextVersion: "v-context-1", fragments: [], measurementType: "estimated", source: "context.compiler" };
      },
    };
    const limits: BudgetLimits = {
      inputTokens: 1,
      outputTokens: 500,
      cachedTokens: 500,
      contextPercent: 100,
      toolDefinitions: 10,
      toolCalls: 10,
      executionMs: 60_000,
      monetaryCost: 1,
      providerQuota: 10_000,
    };

    await expect(core.requestContext(task.task.id, adapter, { objective: "This does not fit", budgetChars: 500, budgetLimits: limits }))
      .rejects.toMatchObject({ code: "BUDGET_EXCEEDED" });
    expect(called).toBe(false);
    expect(core.eventsList().at(-1)?.payload).toEqual(expect.objectContaining({ code: "BUDGET_EXCEEDED", measurementType: "unavailable" }));
    await core.stop();
  });

  it("resolves the MCP catalog inside the Core request and narrows the packet tools", async () => {
    const core = runtime();
    await core.start();
    const task = await core.startTask({ id: "task-1", type: "task.start", idempotencyKey: "start-1", traceId: "trace-1", payload: {} });
    const gateway = new McpGateway([{
      id: "github",
      version: "2026-07-28",
      listTools: async () => [{ name: "git.read_file", domain: "github", capabilities: ["read_file"], description: "Read" }],
      listResources: async () => [],
      health: async () => ({ ok: true, latencyMs: 1 }),
    }], { ttlMs: 1_000 });
    const resolved = packet();
    let received: ContextPacket | undefined;
    const adapter: MgcAdapter = {
      compile: async (request) => {
        received = request.packet;
        return { contextVersion: "v-context-1", fragments: [], measurementType: "estimated", source: "context.compiler" };
      },
    };

    await core.requestContext(task.task.id, adapter, {
      objective: resolved.objective,
      budgetChars: 500,
      packet: resolved,
      mcp: { gateway, serverId: "github", traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01" },
    });

    expect(received?.availableTools).toEqual(["git.read_file"]);
    expect(received?.mcpCatalogVersion).toMatch(/^[a-f0-9]{64}$/);
    expect(core.eventsList().find((event) => event.type === "mcp.catalog.resolved")?.payload).toEqual(expect.objectContaining({ serverId: "github", toolsExposed: 1, traceparent: expect.any(String) }));
    await core.stop();
  });

  it("resolves progressive knowledge context before crossing the MCG boundary", async () => {
    const core = runtime();
    await core.start();
    const task = await core.startTask({ id: "task-progressive", type: "task.start", idempotencyKey: "progressive-1", traceId: "trace-progressive", payload: {} });
    let received: ContextPacket | undefined;
    const adapter: MgcAdapter = {
      compile: async (request) => {
        received = request.packet;
        return { contextVersion: "v-context-progressive", fragments: [], measurementType: "estimated", source: "context.compiler" };
      },
    };
    const contract: TaskContract = {
      taskId: task.task.id,
      goal: "Index knowledge",
      scope: "packages",
      allowedPaths: ["packages"],
      constraints: [],
      capabilities: ["read_file"],
      risk: "low",
      baseSha: "abc123",
      contextBudget: 500,
      toolBudget: 2,
      executionBudget: 1_000,
      preferredProvider: "codex",
      evidenceRequired: true,
    };
    const result = await core.requestProgressiveContext(task.task.id, adapter, {
      contract,
      retriever: {
        symbols: async () => [{ path: "packages/knowledge/note.md", symbols: ["Context"], content: "bounded context", score: 1 }],
        excerpts: async (_task, candidates) => candidates,
      },
      objective: contract.goal,
      budgetChars: contract.contextBudget,
      needsMoreContext: packetValue => packetValue.level < 2,
    });

    expect(result.packet.level).toBe(2);
    expect(received?.relevantFiles[0]?.excerpt).toBe("bounded context");
    expect(result.result.contextVersion).toBe("v-context-progressive");
    await core.stop();
  });
});
