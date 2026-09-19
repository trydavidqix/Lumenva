import { describe, expect, it } from "vitest";
import { isBaselineCovered, isSupabaseManagedUrl } from "../../scripts/migration-policy.mjs";

describe("migration policy", () => {
  it("classifies baseline and new migrations", () => {
    expect(isBaselineCovered("20260814082914_content_os_foundation.sql")).toBe(true);
    expect(isBaselineCovered("20260911100000_0161_entitlements_catalog.sql")).toBe(false);
  });
  it("detects managed Supabase hosts", () => {
    expect(isSupabaseManagedUrl("postgres://x:y@pooler.supabase.com/db.test")).toBe(true);
    expect(isSupabaseManagedUrl("postgres://x:y@aws-1-eu-west-1.pooler.supabase.com/db.test")).toBe(true);
    expect(isSupabaseManagedUrl("postgres://x:y@db.abc.supabase.co:5432/postgres")).toBe(true);
    expect(isSupabaseManagedUrl("postgres://x:y@127.0.0.1:5432/postgres")).toBe(false);
  });
});

