import { describe, expect, it } from "vitest";
import { claimToolLoopLock, completeToolLoopLock, ToolLoopLockError, type ToolLoopLock } from "./session-service";

const baseLock: ToolLoopLock = {
  lock_id: "lock-1",
  session_id: "session-1",
  execution_epoch: 1,
  iteration: 0,
  max_iterations: 2,
  expires_at: "2099-01-01T00:00:00.000Z",
};

describe("ToolLoopLock", () => {
  it("claims one call, rejects concurrent duplicate ownership, then releases it", () => {
    const claimed = claimToolLoopLock(baseLock, "tool-call-1");
    expect(claimed).toMatchObject({ iteration: 1, active_tool_call_id: "tool-call-1" });
    expect(baseLock).toEqual({ ...baseLock });
    expect(() => claimToolLoopLock(claimed, "tool-call-1")).toThrowError(
      new ToolLoopLockError("TOOL_LOOP_BUSY", "tool_loop_call_already_active"),
    );
    const released = completeToolLoopLock(claimed, "tool-call-1");
    expect(released).toMatchObject({ iteration: 1 });
    expect(released).not.toHaveProperty("active_tool_call_id");
  });

  it("rejects a second worker while any call is active", () => {
    const claimed = claimToolLoopLock(baseLock, "tool-call-1");
    expect(() => claimToolLoopLock(claimed, "tool-call-2")).toThrowError("tool_loop_call_already_active");
  });

  it("stops the loop at max_iterations", () => {
    const once = claimToolLoopLock(baseLock, "tool-call-1");
    const twice = completeToolLoopLock(once, "tool-call-1");
    const atLimit = claimToolLoopLock(twice, "tool-call-2");
    expect(atLimit.iteration).toBe(2);
    expect(() => claimToolLoopLock(completeToolLoopLock(atLimit, "tool-call-2"), "tool-call-3")).toThrowError(
      "tool_loop_max_iterations",
    );
  });
});
