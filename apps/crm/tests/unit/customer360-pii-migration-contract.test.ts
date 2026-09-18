import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260918150000_0172_customer360_pii.sql",
  "utf8",
);

describe("Customer 360 PII migration", () => {
  it("provisions encrypted CPF RPCs with fail-closed ACL", () => {
    expect(migration).toContain("create or replace function public.encrypt_cpf");
    expect(migration).toContain("create or replace function public.decrypt_cpf");
    expect(migration).toContain("raise exception 'CPF encryption key unavailable'");
    expect(migration).toMatch(/revoke all on function public\.decrypt_cpf\(uuid, text\) from public, anon/);
    expect(migration).toMatch(/grant execute on function public\.decrypt_cpf\(uuid, text\) to authenticated, service_role/);
  });
});
