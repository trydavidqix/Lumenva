import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { ensureResourceRouterStore, loadWorkers, persistWorker, routeResourcePersisted } from "./resource-router-persistence";

let pool: Pool;
let container = "";

async function waitForPostgres(connectionString: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    try { const probe = new Pool({ connectionString }); await probe.query("select 1"); await probe.end(); return; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); }
  }
  throw new Error("postgres_query_not_ready");
}

describe("resource router postgres persistence", () => {
  beforeAll(async () => {
    const { execFileSync } = await import("node:child_process");
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=postgres", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split(":").pop();
    const connectionString = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
    await waitForPostgres(connectionString);
    pool = new Pool({ connectionString });
    await ensureResourceRouterStore(pool);
  });
  afterAll(async () => { await pool?.end(); if (container) { const { execFileSync } = await import("node:child_process"); execFileSync("docker", ["rm", "-f", container]); } });

  it("persists worker load and routing decision across a fresh pool", async () => {
    await persistWorker(pool, "org-1", { agentId: "linux-1", surface: "Linux", capabilities: ["typescript"], currentLoad: 2, capacity: 10, healthy: true });
    await persistWorker(pool, "org-1", { agentId: "cloud-1", surface: "Cloud", capabilities: ["typescript"], currentLoad: 8, capacity: 10, healthy: true });
    const first = await routeResourcePersisted(pool, "org-1", { taskId: "t1", requiredCapabilities: ["typescript"] });
    expect(first).toEqual({ agentId: "linux-1", surface: "Linux" });
    const rows = await loadWorkers(pool, "org-1");
    expect(rows.find((worker) => worker.agentId === "linux-1")?.currentLoad).toBe(2);
    const freshPool = new Pool({ connectionString: (pool as unknown as { options: { connectionString: string } }).options.connectionString });
    expect(await routeResourcePersisted(freshPool, "org-1", { taskId: "t2", requiredCapabilities: ["typescript"] })).toEqual(first);
    await freshPool.end();
  });
});
