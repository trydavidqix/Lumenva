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
  "commerce_products",
  "commerce_product_variants",
  "commerce_external_mappings",
  "commerce_offers",
  "commerce_offer_variants",
  "commerce_affiliates",
  "commerce_affiliate_links",
  "commerce_affiliate_events",
  "commerce_commission_ledger",
  "commerce_revenue_attribution",
  "commerce_revenue_ledger",
  "commerce_reconciliation_runs",
  "commerce_reconciliation_items",
  "commerce_content_items",
  "commerce_content_variants",
  "commerce_publications",
  "commerce_content_performance",
  "commerce_ads_snapshots",
  "commerce_experiments",
  "commerce_experiment_arms",
  "commerce_experiment_assignments",
  "commerce_experiment_outcomes",
  "commerce_learning_events",
  "commerce_policy_candidates",
  "commerce_policy_versions",
  "commerce_connector_accounts",
  "commerce_webhook_events",
  "commerce_sync_cursors",
  "commerce_jobs",
  "commerce_job_runs",
] as const;

describe("creator commerce revenue OS migration", () => {
  it("creates every tenant-owned durable table with RLS", () => {
    const source = sql();
    for (const table of TENANT_TABLES) {
      expect(source).toContain(`create table if not exists public.${table}`);
      expect(source).toContain(`alter table public.${table} enable row level security`);
      expect(source).toContain(`${table}_tenant_all`);
    }
    expect(source).toContain("fn_user_org_ids()");
    expect(source).not.toMatch(/using\s*\(\s*true\s*\)/);
  });

  it("enforces canonical tenant-aware identities and idempotency", () => {
    const source = sql();
    expect(source).toContain("unique (organization_id, canonical_sku)");
    expect(source).toContain("unique (organization_id, store_id, external_product_id)");
    expect(source).toContain("unique (organization_id, code)");
    expect(source).toContain("unique (organization_id, source, external_event_id)");
  });

  it("uses integer/exact money representations and closed state vocabularies", () => {
    const source = sql();
    expect(source).toContain("unit_amount_minor bigint");
    expect(source).toContain("amount_minor bigint");
    expect(source).toContain("margin_floor_bps integer");
    expect(source).toContain("check (status in ('draft','active','paused','archived'))");
    expect(source).toContain("check (status in ('queued','running','succeeded','failed','cancelled'))");
    expect(source).toContain("check (status in ('draft','running','paused','completed','cancelled'))");
    expect(source).toContain("check (status in ('candidate','pending_approval','approved','rejected','active','superseded'))");
    expect(source).not.toMatch(/\b(real|double precision|float4|float8)\b/);
  });

  it("adds organization-first operational indexes", () => {
    const source = sql();
    expect(source).toContain("commerce_products_org_status_idx");
    expect(source).toContain("commerce_affiliate_events_org_occurred_idx");
    expect(source).toContain("commerce_revenue_ledger_org_occurred_idx");
    expect(source).toContain("commerce_publications_org_status_idx");
    expect(source).toContain("commerce_jobs_org_status_run_after_idx");
    expect(source).toContain("commerce_webhook_events_org_status_idx");
  });
});
