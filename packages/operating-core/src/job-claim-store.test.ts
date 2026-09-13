import { describe, expect, it } from "vitest";
import { PostgresJobClaimStore } from "./job-claim-store.js";

describe("Postgres job claim store", () => {
  it("claims through one INSERT ON CONFLICT DO UPDATE RETURNING statement", async () => {
    const queries: string[] = [];
    const db = { query: async <T>(text: string) => { queries.push(text); return { rows: [{ id: "claim-1", organizationId: "org-1", jobId: "job-1", workerId: "worker-a", status: "CLAIMED", attempts: 1 }] as T[] }; } };
    const claim = await new PostgresJobClaimStore(db).claim("org-1", "job-1", "worker-a");
    expect(claim?.workerId).toBe("worker-a");
    expect(queries).toHaveLength(1);
    expect(queries[0]).toMatch(/insert into public\.operating_core_job_claims/i);
    expect(queries[0]).toMatch(/on conflict \(organization_id,job_id\) do update/i);
    expect(queries[0]).toMatch(/returning/i);
  });

  it("returns no claim when another worker already owns it", async () => {
    const db = { query: async <T>() => ({ rows: [] as T[] }) };
    await expect(new PostgresJobClaimStore(db).claim("org-1", "job-1", "worker-b")).resolves.toBeUndefined();
  });
});
