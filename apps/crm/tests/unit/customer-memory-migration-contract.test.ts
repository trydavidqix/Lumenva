import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260824132000_0132_customer_memory.sql",
);

function sql(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("customer_memory migration contract", () => {
  it("cria chave única composta por organização e contato", () => {
    const content = sql();
    expect(content).toMatch(/create table[^;]*customer_memory/is);
    expect(content).toMatch(/organization_id\s+uuid\s+not null/is);
    expect(content).toMatch(/contact_id\s+uuid\s+not null/is);
    expect(content).toMatch(/unique\s*\(\s*organization_id\s*,\s*contact_id\s*\)/is);
  });

  it("liga RLS e não oferece política global sem tenant", () => {
    const content = sql();
    expect(content).toMatch(/alter table[^;]*customer_memory[^;]*enable row level security/is);
    expect(content).toMatch(/organization_id\s+in\s*\(\s*select\s+fn_user_org_ids\(\)\s*\)/is);
    expect(content).not.toMatch(/using\s*\(\s*true\s*\)/is);
    expect(content).not.toMatch(/with check\s*\(\s*true\s*\)/is);
  });

  it("amarra contact_id à mesma organização por foreign key composta", () => {
    const content = sql();
    expect(content).toMatch(
      /foreign key\s*\(\s*organization_id\s*,\s*contact_id\s*\)[\s\S]*references\s+contacts\s*\(\s*organization_id\s*,\s*id\s*\)/is,
    );
  });
});
