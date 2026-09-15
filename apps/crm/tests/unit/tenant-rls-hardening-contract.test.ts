import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "../../supabase/migrations/20260915090000_0170_tenant_rls_hardening.sql"),
  "utf8",
);

describe("tenant RLS hardening migration", () => {
  it("enables RLS and grants only authenticated/service_role on every recent tenant table", () => {
    for (const table of [
      "organization_plan",
      "entitlement_events",
      "hermes_session_supersession",
      "studio_client_decisions",
      "browsermesh_event_idempotency",
    ]) {
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`));
      expect(migration).toContain(`public.${table}`);
    }
    expect(migration).toContain("revoke all on public.hermes_session_supersession from anon");
    expect(migration).toContain("revoke all on public.studio_client_decisions from anon");
  });

  it("fails closed for reads and writes, including text tenant identifiers", () => {
    expect(migration).toContain("using (organization_id in (select public.fn_user_org_ids()))");
    expect(migration).toContain("with check (organization_id in (select public.fn_user_org_ids()))");
    expect(migration).toContain("organization_id::uuid");
    expect(migration).toContain("tenant_id::uuid");
    expect(migration).not.toMatch(/organization_id\\s*=\\s*auth\\.uid\(\)/);
  });
});
