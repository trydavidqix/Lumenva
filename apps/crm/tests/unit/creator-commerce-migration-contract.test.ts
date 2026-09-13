import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260913190000_0161_creator_commerce_revenue_os.sql",
);

function sql(): string {
  return readFileSync(MIGRATION, "utf8").toLowerCase();
}

const TENANT_TABLES = [
  "creator_profiles",
  "commerce_products",
  "commerce_offers",
  "commerce_campaigns",
  "creative_variants",
  "provider_country_capabilities",
  "sales",
  "sale_items",
  "payments",
  "refunds",
  "chargebacks",
  "affiliate_programs",
  "affiliate_links",
  "affiliate_conversions",
  "commissions",
  "payouts",
  "attributions",
  "revenue_snapshots",
  "revenue_goals",
  "commerce_experiments",
  "commerce_experiment_variants",
] as const;

describe("creator commerce revenue OS migration", () => {
  it("creates every approved tenant-owned table with RLS", () => {
    const source = sql();
    for (const table of TENANT_TABLES) {
      expect(source).toContain(`create table if not exists public.${table}`);
      expect(source).toContain(`alter table public.${table} enable row level security`);
      expect(source).toContain(`${table}_tenant_`);
    }
    expect(source).toContain("fn_user_org_ids()");
    expect(source).not.toMatch(/using\s*\(\s*true\s*\)/);
  });

  it("enforces provider idempotency and tenant-coherent references", () => {
    const source = sql();
    expect(source).toContain("unique (organization_id, provider, external_id)");
    expect(source).toContain("unique (organization_id, canonical_sku)");
    expect(source).toContain("foreign key (organization_id, product_id)");
    expect(source).toContain("foreign key (organization_id, sale_id)");
  });

  it("uses integer minor units for money and closed lifecycle states", () => {
    const source = sql();
    expect(source).toContain("unit_amount_minor bigint");
    expect(source).toContain("amount_minor bigint");
    expect(source).toContain("commission_bps integer");
    expect(source).toContain("check (status in ('draft','active','paused','archived'))");
    expect(source).toContain("check (status in ('pending','approved','reversed','paid'))");
    expect(source).toContain("check (status in ('draft','running','paused','completed','cancelled'))");
    expect(source).not.toMatch(/\b(real|double precision|float4|float8)\b/);
  });

  it("adds organization-first hot-path indexes without broad schema grants", () => {
    const source = sql();
    expect(source).toContain("sales_org_occurred_idx");
    expect(source).toContain("commissions_org_status_idx");
    expect(source).toContain("attributions_org_conversion_idx");
    expect(source).toContain("commerce_experiments_org_status_idx");
    expect(source).not.toContain("grant select, insert, update, delete on all tables in schema public");
    expect(source).not.toContain("grant all on all tables in schema public");
  });
});
