import { describe, expect, it } from "vitest";
import { HandoffPack, MemoryGate, QuotaManager, ToolRuntime, type ToolExecutor } from "./runtime";

describe("Wave 3 session runtime MVP", () => {
  it("enforces tenant-scoped quota and forecasts exhaustion", () => {
    const quota = new QuotaManager({ "org-a": { limit: 10, used: 4 } });
    expect(quota.remaining("org-a")).toBe(6);
    expect(quota.reserve("org-a", 5)).toEqual({ ok: true, remaining: 1 });
    expect(quota.forecast("org-a", 2)).toEqual({ exhausted: true, remaining: 1, requested: 2 });
    expect(() => quota.reserve("org-b", 1)).toThrow("E_QUOTA_NOT_FOUND");
  });

  it("executes a tool once per tenant/epoch/idempotency key and rejects replay across epochs", async () => {
    let calls = 0;
    const executor: ToolExecutor = async ({ tenantId, args }) => { calls += 1; return { tenantId, args, result: "ok" }; };
    const runtime = new ToolRuntime({ "calendar.book": executor }, { tenantIds: ["org-a"] });
    const request = { tenantId: "org-a", sessionId: "session-a", executionEpoch: 2, toolName: "calendar.book", idempotencyKey: "idem-1", args: { slot: "10:00" } };
    const first = await runtime.execute(request);
    const replay = await runtime.execute(request);
    expect(first).toEqual({ kind: "executed", value: { tenantId: "org-a", args: { slot: "10:00" }, result: "ok" } });
    expect(replay).toEqual({ kind: "deduped", value: first.value });
    expect(calls).toBe(1);
    await expect(runtime.execute({ ...request, executionEpoch: 1, idempotencyKey: "idem-old" })).rejects.toThrow("E_STALE_EPOCH");
    await expect(runtime.execute({ ...request, tenantId: "org-b", idempotencyKey: "idem-cross-tenant" })).rejects.toThrow("E_TENANT_MISMATCH");
  });

  it("builds a tenant/epoch handoff pack and gates memory reads and writes", () => {
    const memory = new MemoryGate({ "org-a": { allowedReadTypes: ["fact"], allowedWriteTypes: ["fact"] } });
    memory.write({ tenantId: "org-a", type: "fact", key: "plan", value: "standard" });
    expect(memory.read({ tenantId: "org-a", type: "fact", key: "plan" })?.value).toBe("standard");
    expect(() => memory.read({ tenantId: "org-b", type: "fact", key: "plan" })).toThrow("E_TENANT_MISMATCH");
    expect(() => memory.write({ tenantId: "org-a", type: "secret", key: "token", value: "x" })).toThrow("E_MEMORY_WRITE_FORBIDDEN");
    const pack = HandoffPack.create({ tenantId: "org-a", sessionId: "session-a", executionEpoch: 3, currentGoal: "continue", knownFacts: ["plan=standard"], decisions: ["no provider"], pending: ["confirm slot"] });
    expect(pack.toJSON()).toEqual(expect.objectContaining({ tenantId: "org-a", executionEpoch: 3, currentGoal: "continue" }));
  });
});
