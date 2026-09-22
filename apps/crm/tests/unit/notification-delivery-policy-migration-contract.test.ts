import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260922140000_0201_notification_delivery_policy.sql",
  "utf8",
);

describe("notification delivery policy migration contract", () => {
  it("is fail-closed for outbound voice by default", () => {
    expect(migration).toContain("voice_escalation_enabled boolean not null default false");
    expect(migration).toContain("allowed_voice_destinations text[] not null default '{}'::text[]");
    expect(migration).toContain("max_voice_calls_per_hour");
    expect(migration).toContain("max_voice_calls_per_day");
    expect(migration).toContain("voice_cooldown_seconds");
    expect(migration).toContain("quiet_hours_start");
    expect(migration).toContain("quiet_hours_end");
  });

  it("allows organization members to read but only manager+ to mutate policy", () => {
    expect(migration).toContain("notification_delivery_policies_select_org");
    expect(migration).toMatch(/notification_delivery_policies_insert_org[\s\S]*fn_role_at_least\(organization_id, 'manager'\)/);
    expect(migration).toMatch(/notification_delivery_policies_update_org[\s\S]*fn_role_at_least\(organization_id, 'manager'\)/);
    expect(migration).toMatch(/notification_delivery_policies_delete_org[\s\S]*fn_role_at_least\(organization_id, 'manager'\)/);
  });

  it("contains no provider credentials", () => {
    expect(migration).not.toMatch(/auth_token|sip_password|api_secret|twilio_secret/i);
  });
});
