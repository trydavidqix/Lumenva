import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const migrationsDir = resolve(root, "supabase/migrations");
const baseline = resolve(root, "supabase/baseline.sql");
const manifest = resolve(migrationsDir, "MANIFEST.md");
const migrationName = readdirSync(migrationsDir).find((name) =>
  /_0202_f1_identity_mapping_v2\.sql$/.test(name),
);
const migration = migrationName === undefined ? undefined : resolve(migrationsDir, migrationName);

describe("F1 identity mapping infrastructure", () => {
  it("keeps the adapted migration triple and least-privilege backfill contract aligned", () => {
    expect(migrationName, "F1 migration 0202 is missing").toBeDefined();
    if (migration === undefined) return;

    const sql = readFileSync(migration, "utf8");
    const baselineSql = readFileSync(baseline, "utf8");
    const manifestText = readFileSync(manifest, "utf8");

    expect(sql).toMatch(/create table if not exists public\.identity_user_mapping_candidates/i);
    expect(sql).toMatch(/create table if not exists public\.identity_user_mapping_audit/i);
    expect(sql).toMatch(/create table if not exists public\.identity_migration_flags/i);
    expect(sql).toMatch(/backfill_identity_user_mappings/i);
    expect(sql).toMatch(/identity_user_mapping_.*immutable/i);
    expect(sql).toMatch(/revoke\s+execute\s+on\s+function\s+public\.fn_identity_user_mapping_audit_immutable\(\)[\s\S]*?from\s+public,\s*anon,\s*authenticated,\s*service_role,\s*app_runtime,\s*worker_runtime,\s*platform_admin_runtime/i);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.backfill_identity_user_mappings[\s\S]*?to\s+migration_admin/i);
    expect(sql).not.toMatch(/grant\s+execute\s+on\s+function\s+public\.backfill_identity_user_mappings[\s\S]*?to\s+service_role/i);
    expect(sql).toMatch(/revoke\s+all\s+on\s+table\s+public\.identity_user_mapping_candidates/i);
    expect(sql).toMatch(/revoke\s+all\s+on\s+table\s+public\.identity_user_mapping_audit/i);
    expect(sql).toMatch(/firebase_dual_read/i);
    expect(baselineSql).toMatch(/0202_f1_identity_mapping_v2/i);
    expect(manifestText).toMatch(/0202_f1_identity_mapping_v2/i);
  });

  it.skipIf(!process.env.TEST_DB_CONTAINER)("keeps pending identities out of runtime resolution and makes backfill rerunnable", async () => {
    const { sql } = await import("./pg-exec");
    const activeFirebaseUid = "f1-red-active";
    const pendingFirebaseUid = "f1-red-pending";
    const activeUserId = "aaaaaaaa-0204-4000-8000-000000000001";
    const runId = "aaaaaaaa-0205-4000-8000-000000000001";
    const input = JSON.stringify([
      { firebase_uid: activeFirebaseUid, user_id: activeUserId, match_status: "matched", email_snapshot: "active@f1.test" },
      { firebase_uid: pendingFirebaseUid, match_status: "pending", collision: "missing_membership", email_snapshot: "pending@f1.test" },
    ]).replace(/'/g, "''");

    sql(`delete from public.identity_user_mapping_audit where run_id = '${runId}'::uuid;
         delete from public.identity_user_mapping_candidates where firebase_uid in ('${activeFirebaseUid}', '${pendingFirebaseUid}');
         delete from public.identity_user_mappings where firebase_uid in ('${activeFirebaseUid}', '${pendingFirebaseUid}');`);

    const dryRun = sql(`begin;
      set local role migration_admin;
      select persisted from public.backfill_identity_user_mappings('${input}'::jsonb, '${runId}'::uuid, true);
      commit;`);
    const dryRunResult = dryRun
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^\d+$/.test(line))
      .at(-1);
    expect(dryRunResult).toBe("0");
    expect(sql(`select count(*) from public.identity_user_mappings where firebase_uid in ('${activeFirebaseUid}', '${pendingFirebaseUid}');`)).toBe("0");

    sql(`begin;
      set local role migration_admin;
      select persisted from public.backfill_identity_user_mappings('${input}'::jsonb, '${runId}'::uuid, false);
      select persisted from public.backfill_identity_user_mappings('${input}'::jsonb, '${runId}'::uuid, false);
      commit;`);

    const state = sql(`select coalesce(public.resolve_firebase_identity('${activeFirebaseUid}')::text, 'null');
      select case when public.resolve_firebase_identity('${pendingFirebaseUid}') is null then 'null' else 'resolved' end;
      select count(*) from public.identity_user_mappings where firebase_uid = '${activeFirebaseUid}';
      select count(*) from public.identity_user_mapping_candidates where firebase_uid = '${pendingFirebaseUid}';
      select count(*) from public.identity_user_mapping_audit where run_id = '${runId}'::uuid;`).split("\n");
    expect(state).toEqual([activeUserId, "null", "1", "1", "2"]);

    sql(`delete from public.identity_user_mapping_audit where run_id = '${runId}'::uuid;
         delete from public.identity_user_mapping_candidates where firebase_uid in ('${activeFirebaseUid}', '${pendingFirebaseUid}');
         delete from public.identity_user_mappings where firebase_uid in ('${activeFirebaseUid}', '${pendingFirebaseUid}');`);
  });
});
