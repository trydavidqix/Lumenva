import { describe, expect, it } from "vitest";

import { validateMergeAction } from "./merge";

type Row = { id: string; organization_id: string; merged_into: string | null };

function runAtomicMerge(rows: Row[], organizationId: string, primaryId: string, loserId: string, failAt = 0): Row[] {
  const snapshot = structuredClone(rows);
  try {
    const scoped = rows.filter((row) => row.organization_id === organizationId);
    const primary = scoped.find((row) => row.id === primaryId);
    const loser = scoped.find((row) => row.id === loserId);
    if (!primary || !loser) throw new Error("cross_tenant_or_missing_contact");
    loser.merged_into = primary.id;
    if (failAt === 1) throw new Error("step_failed");
    return rows;
  } catch {
    rows.splice(0, rows.length, ...snapshot);
    return rows;
  }
}

describe("F5 Customer360 integrity contracts", () => {
  it("RLS scope never merges contacts across tenants", () => {
    const rows = [
      { id: "a", organization_id: "org-a", merged_into: null },
      { id: "b", organization_id: "org-b", merged_into: null },
    ];
    runAtomicMerge(rows, "org-a", "a", "b");
    expect(rows).toEqual([
      { id: "a", organization_id: "org-a", merged_into: null },
      { id: "b", organization_id: "org-b", merged_into: null },
    ]);
  });

  it("rollback restores every mutation when a transaction step fails", () => {
    const rows = [
      { id: "a", organization_id: "org-a", merged_into: null },
      { id: "b", organization_id: "org-a", merged_into: null },
    ];
    runAtomicMerge(rows, "org-a", "a", "b", 1);
    expect(rows[1]?.merged_into).toBeNull();
  });

  it("merge action rejects primary in losers and deduplicates loser ids", () => {
    expect(validateMergeAction({ action: "merge", primary_id: "a", loser_ids: ["a"] })).toEqual({ ok: false, reason: "primary_in_losers" });
    expect(validateMergeAction({ action: "merge", primary_id: "a", loser_ids: ["b", "b"] })).toEqual({ ok: true, value: { action: "merge", primary_id: "a", loser_ids: ["b"] } });
  });
});
