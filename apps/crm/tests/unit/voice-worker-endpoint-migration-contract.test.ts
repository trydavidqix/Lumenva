import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = () => readFileSync(join(process.cwd(), "supabase/migrations/20260827014500_0129_voice_worker_endpoints.sql"), "utf8").toLowerCase();

describe("voice worker endpoint registry", () => {
  it("binds one private control endpoint to one technical phone number", () => {
    const source = sql();
    expect(source).toContain("voice_worker_endpoints");
    expect(source).toContain("voice_phone_number_id uuid not null unique");
    expect(source).toContain("control_url");
    expect(source).toContain("^https://");
  });

  it("is RLS-enabled with no authenticated tenant policy", () => {
    const source = sql();
    expect(source).toContain("enable row level security");
    expect(source).not.toContain("create policy");
  });
});
