import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "../..");
const migrationPath = resolve(repoRoot, "supabase/migrations/20260913203000_mobile_compliance_guardian.sql");
const integrityPath = resolve(repoRoot, "supabase/migrations/20260913204000_mobile_compliance_integrity.sql");
const baselinePath = resolve(repoRoot, "supabase/baseline.sql");
const manifestPath = resolve(repoRoot, "supabase/migrations/MANIFEST.md");

function sql(path: string): string { return readFileSync(path, "utf8").toLowerCase(); }

describe("mobile compliance database contract", () => {
  it("normalizes findings and binds child evidence/runtime rows to the tenant report", () => {
    const combined = `${sql(migrationPath)}\n${sql(integrityPath)}`;
    expect(combined).toContain("create table if not exists public.mobile_compliance_findings");
    expect(combined).toContain("foreign key (tenant_id, report_id) references public.mobile_compliance_reports");
    expect(combined).toContain("alter table public.mobile_compliance_findings enable row level security");
    expect(combined).toContain("mobile_compliance_findings_tenant");
  });

  it("keeps the supported fresh-install baseline in sync with the mobile compliance schema", () => {
    const baseline = sql(baselinePath);
    expect(baseline).toContain("create table if not exists public.mobile_compliance_reports");
    expect(baseline).toContain("create table if not exists public.mobile_compliance_findings");
    expect(baseline).toContain("mobile_compliance_reports_tenant");
    expect(baseline).toContain("mobile_compliance_findings_tenant");
  });

  it("documents both Guardian migrations in the migration manifest", () => {
    const manifest = readFileSync(manifestPath, "utf8");
    expect(manifest).toContain("20260913203000");
    expect(manifest).toContain("20260913204000");
    expect(manifest).toContain("mobile_compliance_guardian");
    expect(manifest).toContain("mobile_compliance_integrity");
  });
});
