import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = join(process.cwd(), "supabase/migrations/20260827013000_0128_voice_phone_numbers.sql");
const sql = () => readFileSync(MIGRATION, "utf8").toLowerCase();

describe("voice phone number registry migration", () => {
  it("owns each provider number globally and scopes it to one organization", () => {
    const source = sql();
    expect(source).toContain("create table if not exists public.voice_phone_numbers");
    expect(source).toContain("organization_id uuid not null");
    expect(source).toContain("unique (provider, phone_e164)");
    expect(source).toContain("provider in ('telnyx')");
  });

  it("enables tenant RLS without permissive using(true)", () => {
    const source = sql();
    expect(source).toContain("alter table public.voice_phone_numbers enable row level security");
    expect(source).toContain("fn_user_org_ids()");
    expect(source).not.toMatch(/using\s*\(\s*true\s*\)/);
  });
});
