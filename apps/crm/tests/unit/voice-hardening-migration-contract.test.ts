import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260826125500_0127_voice_hardening.sql"),
  "utf8",
);

describe("voice hardening migration", () => {
  it("closes the persisted provider vocabulary to telnyx", () => {
    expect(migration).toMatch(/voice_calls_provider_check/i);
    expect(migration).toMatch(/voice_call_events_provider_check/i);
    expect(migration).toMatch(/provider in \('telnyx'\)/i);
  });

  it("renames raw payload persistence to normalized attributes", () => {
    expect(migration).toMatch(/rename column payload to attributes/i);
    expect(migration).toMatch(/never raw webhook payloads/i);
  });
});
