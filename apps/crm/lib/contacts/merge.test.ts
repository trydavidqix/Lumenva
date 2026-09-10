import { describe, expect, it } from "vitest";
import { pickPrimary, validateMergeAction } from "./merge";

describe("Customer 360 merge contract", () => {
  it("ranks primary by completeness, dates, then UUID", () => {
    expect(pickPrimary([
      { id: "b", completeness: 3, created_at: "2026-01-01", last_activity_at: "2026-02-01" },
      { id: "a", completeness: 3, created_at: "2026-01-01", last_activity_at: "2026-02-01" },
      { id: "c", completeness: 4, created_at: "2026-03-01", last_activity_at: null },
    ])?.id).toBe("c");
    expect(pickPrimary([
      { id: "b", completeness: 3, created_at: "2026-01-01", last_activity_at: "2026-02-01" },
      { id: "a", completeness: 3, created_at: "2026-01-01", last_activity_at: "2026-02-01" },
    ])?.id).toBe("a");
  });

  it("validates merge and discard actions without provider state", () => {
    expect(validateMergeAction({ action: "discard" })).toEqual({ ok: true, value: { action: "discard" } });
    expect(validateMergeAction({ action: "merge", primary_id: "a", loser_ids: ["b", "b"] })).toEqual({
      ok: true, value: { action: "merge", primary_id: "a", loser_ids: ["b"] },
    });
    expect(validateMergeAction({ action: "merge", primary_id: "a", loser_ids: ["a"] })).toEqual({ ok: false, reason: "primary_in_losers" });
  });
});
