import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { repairFailedBuildPlan, type BuildPlan } from "@/lib/product-factory/build-plan";
import { BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";

const databaseUrl = process.env.DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;
const plan: BuildPlan = { build_plan_id: "pg-repair-plan", organization_id: "pg-org", project_id: "pg-project", source_spec_refs: ["spec"], asset_manifest_refs: ["assets"], target_repo_ref: "repo", target_branch: "wave9", base_sha: "a".repeat(40), allowed_paths: ["apps/site/**"], forbidden_paths: [".env"], commands: ["build"], test_commands: ["test"], acceptance_criteria: ["ok"], authority_envelope_ref: "authority", status: "FAILED", idempotency_key: "repair-1", steps: [{ step_id: "build", dependencies: [], status: "FAILED" }] };
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };

suite("Wave 9 durable repair concurrency", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  beforeAll(async () => { await pool.query("truncate public.build_plan_state"); });
  afterAll(async () => { await pool.end(); });

  it("allows only one worker to claim a failed step and persists terminal BLOCKED", async () => {
    const hold = deferred();
    const started = deferred();
    let executions = 0;
    const execute = async () => { executions += 1; started.resolve(); await hold.promise; return "FAILED" as const; };
    const first = repairFailedBuildPlan(plan, execute, { maxAttempts: 1, stateStore: new BuildPlanStateStore(pool) });
    await started.promise;
    const second = repairFailedBuildPlan(plan, execute, { maxAttempts: 1, stateStore: new BuildPlanStateStore(pool) });
    await expect(second).rejects.toThrow("already RUNNING");
    hold.resolve();
    await expect(first).resolves.toMatchObject({ status: "BLOCKED", attempts: 1 });
    expect(executions).toBe(1);
    const state = await pool.query("select status, attempts from public.build_plan_state where tenant_id=$1 and plan_id=$2 and step_id=$3", [plan.organization_id, plan.build_plan_id, "build"]);
    expect(state.rows[0]).toMatchObject({ status: "BLOCKED", attempts: 1 });
  });
});
