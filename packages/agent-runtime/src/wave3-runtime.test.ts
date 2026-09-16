import { describe, expect, it, vi } from "vitest";
import { buildContext } from "./context.js";
import { ModelLockManager, ToolLoopLock } from "./locks.js";
import { createModelRegistry, routeModel, type ModelDefinition } from "./model.js";

const model = (provider: string, name: string, qualityScore: number): ModelDefinition => ({
  provider,
  model: name,
  status: "CERTIFIED",
  capabilities: ["structured_output", "tool_calling"],
  contextWindow: 10_000,
  privacyClass: "customer_pii",
  qualityScore,
  latencyMs: 100,
});

describe("Wave 3 session runtime foundations", () => {
  it("builds an ordered context with a stable hash and prompt references in blocks 1-8", () => {
    const input = {
      promptHash: "a".repeat(64),
      items: [
        { block: 9, priority: "P1" as const, kind: "goal", content: "Book a demo" },
        { block: 1, priority: "P0" as const, kind: "compiled_prompt", content: "must not be re-rendered" },
      ],
      tokenBudget: 1000,
    };
    const first = buildContext(input);
    const second = buildContext({ ...input, items: [...input.items].reverse() });
    expect(first).toEqual(second);
    expect(first.items[0]).toEqual({ block: 1, priority: "P0", kind: "compiled_prompt", promptHash: input.promptHash });
    expect(first.items[1]).toEqual({ block: 9, priority: "P1", kind: "goal", content: "Book a demo" });
    expect(first.contextHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("routes only certified, capable, privacy-eligible models deterministically", () => {
    const registry = createModelRegistry([model("mock", "slow", 0.8), model("mock", "best", 0.9), { ...model("mock", "experimental", 1), status: "EXPERIMENTAL" }]);
    expect(routeModel(registry, { requiredCapabilities: ["tool_calling"], privacyClass: "customer_pii", contextTokens: 100, reserveOut: 100 }).model).toBe("best");
    expect(() => routeModel(registry, { requiredCapabilities: ["vision"], privacyClass: "customer_pii", contextTokens: 100, reserveOut: 100 })).toThrow("E_MODEL_NO_COMPATIBLE_CANDIDATE");
  });

  it("consults the router once per session epoch and rejects model switches", () => {
    const manager = new ModelLockManager();
    const resolve = vi.fn(() => model("mock", "primary", 1));
    const first = manager.acquire("session-1", 1, resolve);
    expect(manager.acquire("session-1", 1, resolve)).toBe(first);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(() => manager.assertSame(first, model("mock", "fallback", 1))).toThrow("E_MODEL_LOCK_MISMATCH");
  });

  it("holds ToolLoopLock until the final response and rejects mid-loop switches", () => {
    const lock = new ToolLoopLock();
    const primary = model("mock", "primary", 1);
    lock.begin("session-1", primary);
    expect(lock.owner("session-1")).toBe("mock/primary");
    expect(() => lock.assertOwner("session-1", model("mock", "fallback", 1))).toThrow("E_TOOL_LOOP_MODEL_SWITCH");
    expect(() => lock.complete("session-1", primary, true)).toThrow("E_TOOL_LOOP_PENDING_TOOLS");
    lock.complete("session-1", primary, false);
    expect(lock.owner("session-1")).toBeUndefined();
  });
});
