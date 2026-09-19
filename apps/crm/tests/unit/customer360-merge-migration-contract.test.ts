import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260918160000_0197_customer360_merge.sql",
  "utf8",
);

describe("Customer 360 merge migration", () => {
  it("keeps merge atomic, tenant-bound, manager-only, and complete", () => {
    expect(migration).toContain("create or replace function public.merge_contacts");
    expect(migration).toContain("for update");
    expect(migration).toContain("auth.uid() is distinct from p_actor_user_id");
    expect(migration).toContain("fn_role_at_least(v_org, 'manager')");
    expect(migration).toContain("organization_id = v_org");
    expect(migration).toContain("update public.conversations");
    expect(migration).toContain("update public.crm_lead_activities");
    expect(migration).toContain("update public.crm_leads");
    expect(migration).toContain("update public.messages");
    expect(migration).toMatch(/revoke all on function public\.merge_contacts\(uuid, uuid\[\], uuid, uuid\) from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function public\.merge_contacts\(uuid, uuid\[\], uuid, uuid\) to service_role/);
  });
});
