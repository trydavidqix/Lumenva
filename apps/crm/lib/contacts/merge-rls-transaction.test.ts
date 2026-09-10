import { describe, expect, it, vi } from "vitest";
import { canAccessMergeQueue, runAtomicMerge } from "./merge";

describe("Customer 360 merge_queue RLS and transaction invariants", () => {
  it("allows only manager+ ranks and fails closed for agents/invalid ranks", () => {
    expect(canAccessMergeQueue(1)).toBe(false);
    expect(canAccessMergeQueue(2)).toBe(false);
    expect(canAccessMergeQueue(3)).toBe(true);
    expect(canAccessMergeQueue(4)).toBe(true);
    expect(canAccessMergeQueue(Number.NaN)).toBe(false);
  });

  it("commits all operations only after apply succeeds", async () => {
    const tx = {
      begin: vi.fn(async () => {}),
      apply: vi.fn(async () => ({ primary: "a", losers: ["b"] })),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
    };
    await expect(runAtomicMerge(tx)).resolves.toEqual({ primary: "a", losers: ["b"] });
    expect(tx.commit).toHaveBeenCalledOnce();
    expect(tx.rollback).not.toHaveBeenCalled();
  });

  it("rolls back when any merge operation fails", async () => {
    const failure = new Error("merge_step_failed");
    const tx = {
      begin: vi.fn(async () => {}),
      apply: vi.fn(async () => { throw failure; }),
      commit: vi.fn(async () => {}),
      rollback: vi.fn(async () => {}),
    };
    await expect(runAtomicMerge(tx)).rejects.toBe(failure);
    expect(tx.commit).not.toHaveBeenCalled();
    expect(tx.rollback).toHaveBeenCalledOnce();
  });
});
