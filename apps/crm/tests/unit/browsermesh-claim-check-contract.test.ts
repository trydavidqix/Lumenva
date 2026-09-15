import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260913100000_browsermesh_event_idempotency.sql"),
  "utf8",
);
const baseline = readFileSync(resolve(process.cwd(), "supabase/baseline.sql"), "utf8");

describe("browsermesh event idempotency claim constraint", () => {
  it("keeps CLAIMED as a SQL string literal in both schema artifacts", () => {
    const expected = "status text not null check (status in ('CLAIMED'))";

    expect(migration).toContain(expected);
    expect(baseline).toContain(expected);
    expect(baseline).not.toContain("status text not null check (status in (CLAIMED))");
  });

  it("keeps tenant identifiers as uuid in the baseline tables", () => {
    for (const table of ["browsermesh_event_idempotency", "asset_license_records"]) {
      const tableBlock = baseline.match(
        new RegExp(`create table if not exists public\\.${table} \\(([\\s\\S]*?)\\n\\);`),
      )?.[1];

      expect(tableBlock, `missing baseline table ${table}`).toBeDefined();
      expect(tableBlock).toContain("organization_id uuid not null");
      expect(tableBlock).not.toContain("organization_id text not null");
    }
  });
});
