import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { appendJobReceipt, ensureJobReceiptStore, listJobReceipts, type JobReceipt } from "./job-receipt-store";

let pool: Pool;
let container = "";
const receipt: JobReceipt = { receiptId: "receipt-1", organizationId: "org-a", jobId: "job-1", eventId: "event-1", outcome: "completed", evidence: { exitCode: 0, artifactHash: "sha256:abc" }, createdAt: "2026-09-13T00:00:00.000Z" };

describe("Operating Core durable job receipts", () => {
  beforeAll(async () => {
    const { execFileSync } = await import("node:child_process");
    container = execFileSync("docker", ["run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=postgres", "-p", "0:5432", "postgres:16"], { encoding: "utf8" }).trim();
    const port = execFileSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).trim().split("\n")[0]!.split(":").pop();
    const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
    for (let attempt = 0; attempt < 40; attempt += 1) { try { const probe = new Pool({ connectionString: url }); await probe.query("select 1"); await probe.end(); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    pool = new Pool({ connectionString: url });
    await ensureJobReceiptStore(pool);
  });
  afterAll(async () => { await pool?.end(); if (container) { const { execFileSync } = await import("node:child_process"); execFileSync("docker", ["rm", "-f", container]); } });

  it("appends idempotently, reconstructs after a fresh pool, and scopes reads by tenant", async () => {
    const [first, duplicate] = await Promise.all([appendJobReceipt(pool, receipt), appendJobReceipt(pool, receipt)]);
    expect(first).toEqual(duplicate);
    const fresh = new Pool({ connectionString: (pool as unknown as { options: { connectionString: string } }).options.connectionString });
    try {
      expect(await listJobReceipts(fresh, "org-a", "job-1")).toHaveLength(1);
      expect(await listJobReceipts(fresh, "org-b", "job-1")).toEqual([]);
      await expect(fresh.query("DELETE FROM operating_core_job_receipts WHERE organization_id=$1", ["org-a"])).resolves.toBeDefined();
    } finally { await fresh.end(); }
  });
});
