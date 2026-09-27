import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BASELINE = join(process.cwd(), "infra/supabase/baseline.sql");
const ROUTER_MIGRATION = join(process.cwd(), "infra/supabase/migrations/20260927100000_0204_voice_notification_router.sql");
const POLICY_MIGRATION = join(process.cwd(), "infra/supabase/migrations/20260927110000_0205_notification_delivery_policy.sql");

describe("notification router database schema", () => {
  it("installs tenant-bound request and append-only delivery tables from the self-host baseline", () => {
    const sql = readFileSync(BASELINE, "utf8").toLowerCase();

    expect(sql).toContain("create table if not exists public.notification_requests");
    expect(sql).toContain("unique (organization_id, idempotency_key)");
    expect(sql).toContain("unique (organization_id, ack_token)");
    expect(sql).toContain("foreign key (organization_id, contact_id)");
    expect(sql).toContain("create table if not exists public.notification_delivery_attempts");
    expect(sql).toContain("alter table public.notification_requests enable row level security");
    expect(sql).toContain("notification_delivery_attempts_select_org");
  });

  it("permits durable notification jobs only in the existing queue vocabularies", () => {
    const sql = readFileSync(BASELINE, "utf8").toLowerCase();
    const jobKinds = sql.match(/alter table job_queue add constraint job_queue_kind_check[\s\S]*?check\s*\(kind in \(([^)]*)\)\)/)?.[1];
    const cronKinds = sql.match(/alter table cron_jobs add constraint cron_jobs_job_kind_check[\s\S]*?check\s*\(job_kind in \(([^)]*)\)\)/)?.[1];
    const contactBinding = sql.match(/alter table job_queue add constraint job_queue_turn_needs_contact\s+check\s*\(([^;]*)\)/)?.[1];

    expect(jobKinds).toContain("'notification_delivery'");
    expect(cronKinds).toContain("'notification_delivery'");
    expect(contactBinding).toContain("'notification_delivery')) = (contact_id is not null)");
  });

  it("binds delivery attempts to the same tenant as their notification", () => {
    const sql = readFileSync(BASELINE, "utf8").toLowerCase();
    const requests = sql.match(/create table if not exists public\.notification_requests\s*\(([\s\S]*?)\n\);/)?.[1];
    const attempts = sql.match(/create table if not exists public\.notification_delivery_attempts\s*\(([\s\S]*?)\n\);/)?.[1];

    expect(requests).toContain("unique (organization_id, id)");
    expect(requests).toContain("foreign key");
    expect(attempts).toContain("foreign key (organization_id, notification_id)");
    expect(attempts).toContain("references public.notification_requests(organization_id, id)");
  });

  it("makes notification RLS policy definitions rerunnable", () => {
    const router = readFileSync(ROUTER_MIGRATION, "utf8").toLowerCase();
    const policy = readFileSync(POLICY_MIGRATION, "utf8").toLowerCase();
    const sql = `${router}\n${policy}`;
    const policies = [
      "notification_requests_select_org",
      "notification_delivery_attempts_select_org",
      "notification_delivery_policies_select_org",
      "notification_delivery_policies_insert_org",
      "notification_delivery_policies_update_org",
      "notification_delivery_policies_delete_org",
    ];

    for (const name of policies) {
      expect(sql).toContain(`drop policy if exists ${name}`);
      expect(sql).toContain(`create policy ${name}`);
    }
  });
});
