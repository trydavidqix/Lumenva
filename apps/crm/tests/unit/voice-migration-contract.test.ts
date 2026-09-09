import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = join(process.cwd(), "supabase/migrations/20260826111500_0126_voice_calls.sql");

function sql(): string {
  return readFileSync(MIGRATION, "utf8").toLowerCase();
}

describe("voice calls migration", () => {
  it("creates tenant-scoped calls and append-only provider events", () => {
    const source = sql();
    expect(source).toContain("create table if not exists public.voice_calls");
    expect(source).toContain("organization_id uuid not null");
    expect(source).toContain("create table if not exists public.voice_call_events");
    expect(source).toContain("unique (organization_id, provider, provider_event_id)");
  });

  it("enables RLS and scopes policies through fn_user_org_ids without using(true)", () => {
    const source = sql();
    expect(source).toContain("alter table public.voice_calls enable row level security");
    expect(source).toContain("alter table public.voice_call_events enable row level security");
    expect(source).toContain("fn_user_org_ids()");
    expect(source).not.toMatch(/using\s*\(\s*true\s*\)/);
  });

  it("keeps event rows append-only for authenticated users", () => {
    const source = sql();
    expect(source).toContain("voice_call_events_select_org");
    expect(source).not.toContain("voice_call_events_update_org");
    expect(source).not.toContain("voice_call_events_delete_org");
  });
});
