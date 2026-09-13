import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { repairFailedBuildPlan, type BuildPlan } from "@/lib/product-factory/build-plan";
import { BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";

const plan: BuildPlan = {
  build_plan_id: "pg-repair-plan",
  organization_id: "org-a",
  project_id: "pg-project",
  source_spec_refs: ["spec"], asset_manifest_refs: ["assets"], target_repo_ref: "repo",
  target_branch: "wave9", base_sha: "a".repeat(40), allowed_paths: ["apps/site/**"],
  forbidden_paths: [".env"], commands: ["build"], test_commands: ["test"],
  acceptance_criteria: ["ok"], authority_envelope_ref: "authority", status: "FAILED",
  idempotency_key: "repair-1", steps: [{ step_id: "build", dependencies: [], status: "FAILED" }],
};

describe("Wave 9 durable repair state against real Postgres RLS", () => {
  let container = "";
  let admin: Pool;
  let tenantUrl = "";

  beforeAll(async () => {
    container = execFileSync("docker", ["run", "--rm", "-d", "-e", "POSTGRES_PASSWORD=test", "-p", "127.0.0.1::5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().match(/:(\d+)$/)?.[1];
    if (!port) throw new Error("postgres_port_missing");
    const adminUrl = `postgres://postgres:test@127.0.0.1:${port}/postgres`;
    admin = new Pool({ connectionString: adminUrl });
    for (let attempt = 0; attempt < 90; attempt += 1) {
      try { await admin.query("select 1"); break; } catch (error) {
        if (attempt === 89) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    await admin.query("create role authenticated nologin");
    await admin.query("create role service_role nologin");
    await admin.query("create role build_state_test login password 'build-state-test' nosuperuser nobypassrls in role authenticated");
    await admin.query("create or replace function public.fn_user_org_ids() returns setof text language sql stable as $$ select unnest(string_to_array(current_setting('app.org_ids', true), ',')) $$");
    await admin.query(readFileSync("supabase/migrations/20260913000000_build_plan_state.sql", "utf8"));
    await admin.query(readFileSync("supabase/migrations/20260913150000_0162_build_plan_state_rls.sql", "utf8"));
    await admin.query("insert into public.build_plan_state (tenant_id, plan_id, step_id, status, attempts) values ('org-b','other-plan','build','READY',0)");
    tenantUrl = `postgres://build_state_test:build-state-test@127.0.0.1:${port}/postgres`;
  }, 30_000);

  afterAll(async () => {
    await admin?.end();
    if (container) execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" });
  });

  it("allows one concurrent repair claim, persists BLOCKED, and rejects cross-tenant access", async () => {
    const firstPool = new Pool({ connectionString: tenantUrl });
    const secondPool = new Pool({ connectionString: tenantUrl });
    try {
      await firstPool.query("select set_config('app.org_ids', 'org-a', false)");
      await secondPool.query("select set_config('app.org_ids', 'org-a', false)");
      const hold = { promise: null as Promise<void> | null, resolve: null as (() => void) | null };
      hold.promise = new Promise<void>((resolve) => { hold.resolve = resolve; });
      let executions = 0;
      let started!: () => void;
      const startedPromise = new Promise<void>((resolve) => { started = resolve; });
      const execute = async () => { executions += 1; started(); await hold.promise; return "FAILED" as const; };
      const first = repairFailedBuildPlan(plan, execute, { maxAttempts: 1, stateStore: new BuildPlanStateStore(firstPool) });
      await startedPromise;
      const second = repairFailedBuildPlan(plan, execute, { maxAttempts: 1, stateStore: new BuildPlanStateStore(secondPool) });
      await expect(second).rejects.toThrow("already RUNNING");
      hold.resolve!();
      await expect(first).resolves.toMatchObject({ status: "BLOCKED", attempts: 1 });
      expect(executions).toBe(1);
      const restarted = new Pool({ connectionString: tenantUrl });
      try {
        await restarted.query("select set_config('app.org_ids', 'org-a', false)");
        await expect(restarted.query("select status, attempts from public.build_plan_state where tenant_id='org-a' and plan_id='pg-repair-plan'"))
          .resolves.toMatchObject({ rows: [{ status: "BLOCKED", attempts: 1 }] });
        await expect(restarted.query("select * from public.build_plan_state where tenant_id='org-b'"))
          .resolves.toMatchObject({ rows: [] });
        await expect(restarted.query("insert into public.build_plan_state (tenant_id, plan_id, step_id, status, attempts) values ('org-b','cross-plan','build','READY',0)"))
          .rejects.toMatchObject({ code: "42501" });
      } finally {
        await restarted.end();
      }
    } finally {
      await firstPool.end();
      await secondPool.end();
    }
  }, 30_000);
});
