import { describe, expect, it } from "vitest";
import {
  claimToolLoopLock,
  completeToolLoopLock,
  ToolLoopLockError,
  ToolLoopLockStore,
  type ToolLoopLock,
} from "./session-service";

const NOW = new Date("2026-09-12T18:00:00.000Z");
const baseLock: ToolLoopLock = {
  lock_id: "lock-1",
  session_id: "session-1",
  execution_epoch: 7,
  iteration: 0,
  max_iterations: 2,
  expires_at: "2026-09-12T19:00:00.000Z",
};

describe("ToolLoopLock", () => {
  it("claims one call, rejects concurrent duplicate ownership, then releases it", () => {
    const claimed = claimToolLoopLock(baseLock, "tool-call-1", 7, NOW);
    expect(claimed).toMatchObject({ iteration: 1, active_tool_call_id: "tool-call-1" });
    expect(baseLock).toEqual({ ...baseLock });
    expect(() => claimToolLoopLock(claimed, "tool-call-1", 7, NOW)).toThrowError(
      new ToolLoopLockError("TOOL_LOOP_BUSY", "tool_loop_call_already_active"),
    );
    const released = completeToolLoopLock(claimed, "tool-call-1", 7, NOW);
    expect(released).toMatchObject({ iteration: 1 });
    expect(released).not.toHaveProperty("active_tool_call_id");
  });

  it("allows only one winner for two concurrent claims", async () => {
    const store = new ToolLoopLockStore(baseLock);
    const results = await Promise.allSettled([
      Promise.resolve().then(() => store.claim("tool-call-1", 7, NOW)),
      Promise.resolve().then(() => store.claim("tool-call-2", 7, NOW)),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(ToolLoopLockError);
    expect(rejected?.reason.code).toBe("TOOL_LOOP_BUSY");
    expect(store.get("lock-1")).toMatchObject({ iteration: 1 });
  });

  it("rejects a second worker and a stale execution epoch", () => {
    const claimed = claimToolLoopLock(baseLock, "tool-call-1", 7, NOW);
    expect(() => claimToolLoopLock(claimed, "tool-call-2", 7, NOW)).toThrowError(
      "tool_loop_call_already_active",
    );
    expect(() => completeToolLoopLock(claimed, "tool-call-1", 8, NOW)).toThrowError(
      "tool_loop_execution_epoch_mismatch",
    );
  });

  it("stops the loop at max_iterations", () => {
    const once = claimToolLoopLock(baseLock, "tool-call-1", 7, NOW);
    const twice = completeToolLoopLock(once, "tool-call-1", 7, NOW);
    const atLimit = claimToolLoopLock(twice, "tool-call-2", 7, NOW);
    expect(atLimit.iteration).toBe(2);
    expect(() => claimToolLoopLock(completeToolLoopLock(atLimit, "tool-call-2", 7, NOW), "tool-call-3", 7, NOW)).toThrowError(
      "tool_loop_max_iterations",
    );
  });

  it("fails closed when the lock is expired", () => {
    expect(() => claimToolLoopLock(baseLock, "tool-call-1", 7, new Date("2026-09-12T19:00:00.000Z"))).toThrowError(
      "tool_loop_lock_expired",
    );
  });
});
