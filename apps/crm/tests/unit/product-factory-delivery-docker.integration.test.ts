import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BuildPlanStateStore, type Queryable } from "@/lib/product-factory/build-plan-state-store";
import { executeDeliveryWithGate, type DeliveryArtifact, type DeliveryBuildEvidence, type DeliveryPlan } from "@/lib/product-factory/delivery";

const exec = promisify(execFile);
const container = `wave10-delivery-pg-${process.pid}`;
const tenant = "tenant-a";
const otherTenant = "tenant-b";
const plan: DeliveryPlan = { delivery_plan_id: "plan-real", organization_id: tenant, project_id: "project", build_ref: "build", channels: ["MANAGED_SERVICE"], environment: "LOCAL", release_policy_version: "policy", rollout: "NONE", support_owner: "owner", acceptance_criteria: ["ok"], status: "PACKAGED" };
const artifact: DeliveryArtifact = { delivery_artifact_id: "artifact", delivery_plan_id: plan.delivery_plan_id, artifact_ref: "artifact://real", content_hash: "a".repeat(64), platform: "WEB", version: "1", provenance_refs: ["source"], security_scan_refs: ["scan"], test_refs: ["test"], status: "VERIFIED" };
const evidence: DeliveryBuildEvidence = { build_ref: plan.build_ref, organization_id: tenant, project_id: plan.project_id, source_refs: ["source"], test_refs: ["test"], policy_version: plan.release_policy_version, evidence_refs: ["evidence"] };

function quote(value: unknown): string { return "'" + String(value).replace(/'/g, "''") + "'"; }
async function psql(args: string[], asUser = "postgres"): Promise<string> {
  const { stdout } = await exec("docker", ["exec", container, "psql", "-U", asUser, "-d", "test", "-At", "-F", "	", ...args]);
  return stdout.trim();
}
function client(tenantId: string): Queryable {
  return {
    async query<T = unknown>(text: string, values: unknown[] = []): Promise<{ rows: T[] }> {
      const prefix = "set app.tenant_id = " + quote(tenantId) + ";";
      let sql: string;
      if (text.startsWith("select id,status")) {
        sql = `${prefix} select id,status,attempts,blocked_at from public.build_plan_state where tenant_id=${quote(values[0])} and plan_id=${quote(values[1])} and step_id=${quote(values[2])};`;
      } else if (text.startsWith("insert into public.build_plan_state")) {
        sql = `${prefix} insert into public.build_plan_state (tenant_id,plan_id,step_id,status,attempts) values (${quote(values[0])},${quote(values[1])},${quote(values[2])},'RUNNING',1) on conflict (tenant_id,plan_id,step_id) do update set status='RUNNING',attempts=build_plan_state.attempts+1,blocked_at=null,updated_at=now() where build_plan_state.status not in ('RUNNING','BLOCKED','SUCCEEDED') returning id,status,attempts,blocked_at;`;
      } else if (text.startsWith("update public.build_plan_state")) {
        sql = `${prefix} update public.build_plan_state set status=${quote(values[3])},blocked_at=case when ${quote(values[3])}='BLOCKED' then now() else null end,updated_at=now() where tenant_id=${quote(values[0])} and plan_id=${quote(values[1])} and step_id=${quote(values[2])};`;
      } else {
        sql = prefix + text;
      }
      const stdout = await psql(["-v", "ON_ERROR_STOP=1", "-c", sql], "app_user");
      const lines = stdout ? stdout.split("\n").filter((line) => /^[0-9a-f-]{36}\t/.test(line)) : [];
      const rows = lines.map((line) => {
        const [id, status, attempts, blocked_at] = line.split("\t");
        return { id, status, attempts: attempts ? Number(attempts) : attempts, blocked_at: blocked_at || null } as T;
      });
      return { rows };
    },
  };
}

describe("Wave 10 delivery gate with real PostgreSQL and RLS", () => {
  beforeAll(async () => {
    await exec("docker", ["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=test", "-e", "POSTGRES_DB=test", "postgres:16"]);
    for (let i = 0; i < 60; i += 1) {
      try { await exec("docker", ["exec", container, "pg_isready", "-U", "postgres", "-d", "test"]); await psql(["-c", "select 1"]); break; } catch { if (i === 59) throw new Error("postgres did not become ready"); await new Promise((resolve) => setTimeout(resolve, 250)); }
    }
    await psql(["-v", "ON_ERROR_STOP=1", "-c", "create role app_user login; create table public.build_plan_state (id uuid primary key default gen_random_uuid(), tenant_id text not null, plan_id text not null, step_id text not null, status text not null, attempts integer not null default 0, blocked_at timestamptz, updated_at timestamptz not null default now(), unique (tenant_id,plan_id,step_id)); alter table public.build_plan_state enable row level security; create policy build_plan_state_tenant on public.build_plan_state for all to app_user using (tenant_id=current_setting('app.tenant_id', true)) with check (tenant_id=current_setting('app.tenant_id', true)); grant usage on schema public to app_user; grant select,insert,update on public.build_plan_state to app_user;"]);
  }, 120_000);

  afterAll(async () => { await exec("docker", ["rm", "-f", container]).catch(() => undefined); });

  it("allows one concurrent claim, persists SUCCEEDED, and prevents cross-tenant visibility", async () => {
    const firstStore = new BuildPlanStateStore(client(tenant));
    const secondStore = new BuildPlanStateStore(client(tenant));
    const outcomes = await Promise.allSettled([
      executeDeliveryWithGate(plan, artifact, evidence, firstStore, async () => undefined),
      executeDeliveryWithGate(plan, artifact, evidence, secondStore, async () => undefined),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    const visible = await client(tenant).query("select id,status,attempts,blocked_at from public.build_plan_state where tenant_id=$1 and plan_id=$2 and step_id=$3", [tenant, plan.delivery_plan_id, "delivery-gate"]);
    expect(visible.rows[0]).toMatchObject({ status: "SUCCEEDED", attempts: 1 });
    const hidden = await client(otherTenant).query("select id,status,attempts,blocked_at from public.build_plan_state where tenant_id=$1 and plan_id=$2 and step_id=$3", [tenant, plan.delivery_plan_id, "delivery-gate"]);
    expect(hidden.rows).toHaveLength(0);
  }, 120_000);
});
