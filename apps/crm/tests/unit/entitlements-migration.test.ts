import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PREMIUM_MODULE_SLUGS, PREMIUM_PLAN_SLUG, PREMIUM_TEST_TENANTS } from "../fixtures/entitlements-premium";

const migration = readFileSync(join(process.cwd(), "apps/crm/supabase/migrations/20260911100000_0161_entitlements_catalog.sql"), "utf8");

describe("entitlements migration contract", () => {
  it("defines the catalog, tenant assignment and append-only idempotent events", () => {
    for (const table of ["plans", "modules", "plan_modules", "organization_plan", "entitlement_events"]) {
      expect(migration).toContain("public." + table);
      expect(migration).toContain("alter table public." + table + " enable row level security");
    }
    expect(migration).toContain("unique (organization_id, idempotency_key)");
    expect(migration).toContain("fn_user_org_ids()");
    expect(migration).toContain("fn_is_platform_admin()");
  });

  it("seeds a deterministic Premium catalog and exposes safe tenant fixtures", () => {
    expect(migration).toContain("'" + PREMIUM_PLAN_SLUG + "'");
    for (const module of PREMIUM_MODULE_SLUGS) expect(migration).toContain("'" + module + "'");
    expect(PREMIUM_TEST_TENANTS).toHaveLength(2);
    expect(migration).not.toMatch(/(api[_ -]?key|secret[[:space:]]*[:=]|password[[:space:]]*[:=]|token[[:space:]]*[:=])/i);
  });
});
