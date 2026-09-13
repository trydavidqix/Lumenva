import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BuildPlanStateStore, type Queryable } from "@/lib/product-factory/build-plan-state-store";
import { repairFailedBuildPlan, type BuildPlan } from "@/lib/product-factory/build-plan";

const exec = promisify(execFile);
const container = `wave9-repair-pg-${process.pid}`;
const tenant = "tenant-a";
const plan: BuildPlan = { build_plan_id: "plan-real", organization_id: tenant, project_id: "project", source_spec_refs: ["source"], asset_manifest_refs: ["assets"], target_repo_ref: "repo", target_branch: "branch", base_sha: "a".repeat(40), allowed_paths: ["apps/**"], forbidden_paths: [".env"], commands: ["build"], test_commands: ["test"], acceptance_criteria: ["ok"], authority_envelope_ref: "authority", status: "FAILED", idempotency_key: "idem", steps: [{ step_id: "build", dependencies: [], status: "FAILED" }] };

function quote(value: unknown): string { return "'" + String(value).replace(/'/g, "''") + "'"; }
async function psql(args: string[], user = "postgres"): Promise<string> {
  const { stdout } = await exec("docker", ["exec", container, "psql", "-U", user, "-d", "test", "-At", "-F", "	", ...args]);
  return stdout.trim();
}
function client(tenantId: string): Queryable {
  return {
    async query<T = unknown>(text: string, values: unknown[] = []): Promise<{ rows: T[] }> {
      const prefix = "set app.tenant_id = " + quote(tenantId) + ";";
      let sql = prefix;
      if (text.startsWith("select id,status")) sql += ` select id,status,attempts,blocked_at from public.build_plan_state where tenant_id=${quote(values[0])} and plan_id=${quote(values[1])} and step_id=${quote(values[2])};`;
      else if (text.startsWith("update public.build_plan_state set status='RUNNING'")) sql += ` update public.build_plan_state set status='RUNNING',attempts=attempts+1,blocked_at=null,updated_at=now() where tenant_id=${quote(values[0])} and plan_id=${quote(values[1])} and step_id=${quote(values[2])} and status not in ('RUNNING','BLOCKED','SUCCEEDED') returning id,status,attempts,blocked_at;`;
      else if (text.startsWith("insert into public.build_plan_state")) sql += ` insert into public.build_plan_state (tenant_id,plan_id,step_id,status,attempts) values (${quote(values[0])},${quote(values[1])},${quote(values[2])},'RUNNING',1) on conflict (tenant_id,plan_id,step_id) do nothing returning id,status,attempts,blocked_at;`;
      else if (text.startsWith("update public.build_plan_state set status=$4")) sql += ` update public.build_plan_state set status=${quote(values[3])},blocked_at=case when ${quote(values[3])}='BLOCKED' then now() else null end,updated_at=now() where tenant_id=${quote(values[0])} and plan_id=${quote(values[1])} and step_id=${quote(values[2])};`;
      else sql += text;
      const stdout = await psql(["-v", "ON_ERROR_STOP=1", "-c", sql], "app_user");
      const rows = stdout.split("\n").filter((line) => /^[0-9a-f-]{36}\t/.test(line)).map((line) => {
        const [id, status, attempts, blocked_at] = line.split("\t");
        return { id, status, attempts: attempts ? Number(attempts) : attempts, blocked_at: blocked_at || null } as T;
      });
      return { rows };
    },
  };
}

describe("Wave 9 repair loop with real PostgreSQL and RLS", () => {
  beforeAll(async () => {
    await exec("docker", ["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=test", "-e", "POSTGRES_DB=test", "postgres:16"]);
    for (let i = 0; i < 60; i += 1) {
      try { await exec("docker", ["exec", container, "pg_isready", "-U", "postgres", "-d", "test"]); await psql(["-c", "select 1"]); break; } catch { if (i === 59) throw new Error("postgres did not become ready"); await new Promise((resolve) => setTimeout(resolve, 250)); }
    }
    await psql(["-v", "ON_ERROR_STOP=1", "-c", "create role app_user login; create table public.build_plan_state (id uuid primary key default gen_random_uuid(), tenant_id text not null, plan_id text not null, step_id text not null, status text not null, attempts integer not null default 0, blocked_at timestamptz, updated_at timestamptz not null default now(), unique (tenant_id,plan_id,step_id)); alter table public.build_plan_state enable row level security; create policy build_plan_state_tenant on public.build_plan_state for all to app_user using (tenant_id=current_setting('app.tenant_id', true)) with check (tenant_id=current_setting('app.tenant_id', true)); grant usage on schema public to app_user; grant select,insert,update on public.build_plan_state to app_user;"]);
  }, 120_000);
  afterAll(async () => { await exec("docker", ["rm", "-f", container]).catch(() => undefined); });
  it("persists one terminal BLOCKED state across concurrent repair clients and isolates tenants", async () => {
    const run = (store: BuildPlanStateStore) => repairFailedBuildPlan(plan, async () => "FAILED", { maxAttempts: 1, stateStore: store });
    const outcomes = await Promise.allSettled([run(new BuildPlanStateStore(client(tenant))), run(new BuildPlanStateStore(client(tenant)))]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    const row = await client(tenant).query("select id,status,attempts,blocked_at from public.build_plan_state where tenant_id=$1 and plan_id=$2 and step_id=$3", [tenant, plan.build_plan_id, "build"]);
    expect(row.rows[0]).toMatchObject({ status: "BLOCKED", attempts: 1 });
    expect((await client("tenant-b").query("select id,status,attempts,blocked_at from public.build_plan_state where tenant_id=$1 and plan_id=$2 and step_id=$3", [tenant, plan.build_plan_id, "build"])).rows).toHaveLength(0);
  }, 120_000);
});
