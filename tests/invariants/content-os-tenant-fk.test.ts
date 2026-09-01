import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260814082914_content_os_foundation.sql", "utf8");
const baseline = readFileSync("supabase/baseline.sql", "utf8");

describe("Content OS tenant FK integrity", () => {
  it("installs a SECURITY DEFINER tenant trigger and rejects mismatched parent organizations", () => {
    for (const sql of [migration, baseline]) {
      expect(sql).toContain("content_os_enforce_tenant_fk");
      expect(sql).toContain("parent_org <> NEW.organization_id");
      expect(sql).toContain("using errcode = '23514'");
      expect(sql).toContain("competitor_events_monitor_tenant");
    }
  });
});
