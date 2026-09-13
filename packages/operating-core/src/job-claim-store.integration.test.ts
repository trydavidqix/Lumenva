import pg from "pg";
import { describe, expect, it } from "vitest";
import { PostgresJobClaimStore } from "./job-claim-store.js";

describe("Postgres job claim store against real database", () => {
  it("allows exactly one concurrent worker and survives a new store instance", async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for this integration test");
    const pool = new pg.Pool({ connectionString: databaseUrl });
    try {
      await pool.query("truncate public.operating_core_job_claims");
      const first = new PostgresJobClaimStore(pool);
      const second = new PostgresJobClaimStore(pool);
      const results = await Promise.all([
        first.claim("org-1", "job-1", "worker-a"),
        second.claim("org-1", "job-1", "worker-b"),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect((await new PostgresJobClaimStore(pool).get("org-1", "job-1"))?.status).toBe("CLAIMED");
      const winner = results.find(Boolean)!;
      const released = await first.release("org-1", "job-1", winner.workerId);
      expect(released?.status).toBe("RELEASED");
      const afterRestart = await new PostgresJobClaimStore(pool).claim("org-1", "job-1", "worker-c");
      expect(afterRestart?.workerId).toBe("worker-c");
      expect(afterRestart?.attempts).toBe(2);
    } finally {
      await pool.end();
    }
  });
});
