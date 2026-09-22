import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260922133000_0200_voice_notification_router.sql",
  "utf8",
);

describe("Notification Router migration contract", () => {
  it("creates tenant-scoped durable notification state and delivery ledger", () => {
    expect(migration).toContain("create table if not exists public.notification_requests");
    expect(migration).toContain("create table if not exists public.notification_delivery_attempts");
    expect(migration).toContain("unique (organization_id, idempotency_key)");
    expect(migration).toContain("unique (organization_id, ack_token)");
    expect(migration).toContain("alter table public.notification_requests enable row level security");
    expect(migration).toContain("notification_requests_select_org");
    expect(migration).toContain("notification_delivery_attempts_select_org");
  });

  it("extends both durable queue constraints for notification_delivery", () => {
    expect(migration).toMatch(/job_queue_kind_check[\s\S]*notification_delivery/);
    expect(migration).toMatch(/job_queue_turn_needs_contact[\s\S]*notification_delivery/);
    expect(migration).toMatch(/cron_jobs_job_kind_check[\s\S]*notification_delivery/);
  });

  it("does not persist provider secrets", () => {
    expect(migration).not.toMatch(/auth_token|api_secret|sip_password|twilio_secret/i);
  });
});
