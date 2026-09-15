import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/20260913100000_browsermesh_event_idempotency.sql"),
  "utf8",
);
const baseline = readFileSync(resolve(process.cwd(), "../../supabase/baseline.sql"), "utf8");

describe("browsermesh event idempotency claim constraint", () => {
  it("keeps CLAIMED as a SQL string literal in both schema artifacts", () => {
    const expected = "status text not null check (status in ('CLAIMED'))";

    expect(migration).toContain(expected);
    expect(baseline).toContain(expected);
    expect(baseline).not.toContain("status text not null check (status in (CLAIMED))");
  });
});
