import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { ensureOverviewStore, loadOverview, saveOverview } from "../apps/crm/lib/command-center/overview-state-persistence";

let pool: Pool;
let container = "";

describe("Command Center persisted costs and approvals", () => {
  beforeAll(async () => {
    const { execFileSync } = await import("node:child_process");
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=postgres", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split("\n")[0]!.split(":").pop();
    const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
    for (let attempt = 0; attempt < 40; attempt += 1) { try { const probe = new Pool({ connectionString: url }); await probe.query("select 1"); await probe.end(); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    pool = new Pool({ connectionString: url });
    await ensureOverviewStore(pool);
  });
  afterAll(async () => { await pool?.end(); if (container) { const { execFileSync } = await import("node:child_process"); execFileSync("docker", ["rm", "-f", container]); } });

  it("reconstructs costs and approval decisions from a fresh pool", async () => {
    const input = {
      organizationId: "org-costs",
      generatedAt: "2026-09-13T00:00:00.000Z",
      agents: [],
      costs: [{ id: "cost-1", amount: 12.5, currency: "EUR", organizationId: "org-costs", tenantId: "org-costs", jobId: "job-1" }],
      jobs: [],
      approvals: [
        { id: "approval-pending", action: "publish", requestedBy: "agent-1", status: "PENDING" as const, organizationId: "org-costs" },
        { id: "approval-denied", action: "delete", requestedBy: "agent-1", status: "DENIED" as const, decidedBy: "owner-1", decidedAt: "2026-09-12T23:00:00.000Z", organizationId: "org-costs" },
      ],
    };
    await saveOverview(pool, input);
    const connectionString = (pool as unknown as { options: { connectionString: string } }).options.connectionString;
    const fresh = new Pool({ connectionString });
    try {
      const state = await loadOverview(fresh, "org-costs");
      expect(state).toMatchObject({ accumulatedCost: { amount: 12.5, currency: "EUR" }, costEntries: [{ id: "cost-1", tenantId: "org-costs" }], pendingApprovals: [{ id: "approval-pending" }], resolvedApprovals: [{ id: "approval-denied", status: "DENIED", decidedBy: "owner-1" }] });
    } finally { await fresh.end(); }
  });
});
