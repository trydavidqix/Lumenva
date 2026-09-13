import { Pool } from "pg";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { BuildPlanStateStore } from "@/lib/product-factory/build-plan-state-store";
import { DeliveryReceiptStore, createDeliveryReceipt } from "@/lib/product-factory/receipt";
import { validateDeliveryPlanWithState } from "@/lib/product-factory/delivery";
import type { DeliveryArtifact, DeliveryBuildEvidence, DeliveryPlan } from "@/lib/product-factory/delivery";

const url = process.env.DELIVERY_RECEIPT_DATABASE_URL;
if (!url) throw new Error("DELIVERY_RECEIPT_DATABASE_URL required for PostgreSQL proof");
const suite = describe;
const plan: DeliveryPlan = { delivery_plan_id: "pg-concurrent-plan", organization_id: "pg-org", project_id: "pg-project", build_ref: "pg-build", channels: ["MANAGED_SERVICE"], environment: "LOCAL", release_policy_version: "policy-1", rollout: "NONE", support_owner: "owner", acceptance_criteria: ["handoff"], status: "PACKAGED" };
const artifact: DeliveryArtifact = { delivery_artifact_id: "pg-artifact", delivery_plan_id: plan.delivery_plan_id, artifact_ref: "artifact://pg-build", content_hash: "a".repeat(64), platform: "WEB", version: "1", provenance_refs: ["source"], security_scan_refs: ["security"], test_refs: ["test"], status: "VERIFIED" };
const evidence: DeliveryBuildEvidence = { build_ref: plan.build_ref, organization_id: plan.organization_id, project_id: plan.project_id, source_refs: ["source"], test_refs: ["test"], policy_version: "policy-1", evidence_refs: ["evidence"] };
const stateStore = () => new BuildPlanStateStore({ async query<T>(sql: string): Promise<{ rows: T[] }> { if (sql.startsWith("select")) return { rows: [] }; return { rows: [{ id: "gate", status: "RUNNING", attempts: 1, blocked_at: null }] as T[] }; } });

suite("delivery receipt Postgres concurrency", () => {
  const pools: Pool[] = [];
  beforeAll(async () => {
    const pool = new Pool({ connectionString: url }); pools.push(pool);
    await pool.query("create table if not exists public.delivery_receipts (tenant_id text not null, delivery_receipt_id text not null, delivery_plan_id text not null, organization_id text not null, artifact_refs jsonb not null, environment text not null, actor_id text not null, channel text not null, approval_id text, result text not null, support_ticket_ref text, evidence_refs jsonb not null, created_at timestamptz not null, content_hash text not null, primary key (tenant_id, delivery_receipt_id))");
    await pool.query("delete from public.delivery_receipts where tenant_id=$1", [plan.organization_id]);
  });
  afterAll(async () => { await Promise.all(pools.map((pool) => pool.end())); });
  it("returns one canonical row for concurrent inserts from separate stores", async () => {
    const firstPool = new Pool({ connectionString: url }); const secondPool = new Pool({ connectionString: url }); pools.push(firstPool, secondPool);
    const options = { delivery_receipt_id: "pg-receipt-1", actor_id: "actor", channel: "MANAGED_SERVICE" as const, created_at: "2026-09-13T00:00:00.000Z" };
    const [first, second] = await Promise.all([
      createDeliveryReceipt(plan, artifact, evidence, stateStore(), new DeliveryReceiptStore(firstPool), options),
      createDeliveryReceipt(plan, artifact, evidence, stateStore(), new DeliveryReceiptStore(secondPool), options),
    ]);
    expect(first).toEqual(second);
    expect((await firstPool.query("select count(*)::int as count from public.delivery_receipts where tenant_id=$1 and delivery_receipt_id=$2", [plan.organization_id, options.delivery_receipt_id])).rows[0].count).toBe(1);
  });
  it("persists a BLOCKED delivery gate in Postgres and rejects replay", async () => {
    const pool = new Pool({ connectionString: url }); pools.push(pool);
    await pool.query("delete from public.build_plan_state where tenant_id=$1 and plan_id=$2", [plan.organization_id, plan.delivery_plan_id]);
    const invalidArtifact = { ...artifact, content_hash: "" };
    const persistedStore = new BuildPlanStateStore(pool);
    const first = await validateDeliveryPlanWithState(plan, invalidArtifact, evidence, persistedStore);
    expect(first.valid).toBe(false);
    const row = await pool.query("select status, attempts, blocked_at from public.build_plan_state where tenant_id=$1 and plan_id=$2 and step_id='delivery-gate'", [plan.organization_id, plan.delivery_plan_id]);
    expect(row.rows[0]).toMatchObject({ status: "BLOCKED", attempts: 1 });
    expect(row.rows[0].blocked_at).toBeTruthy();
    const replay = await validateDeliveryPlanWithState(plan, artifact, evidence, persistedStore);
    expect(replay).toEqual({ valid: false, errors: ["delivery gate is terminally BLOCKED"] });
  });
});
