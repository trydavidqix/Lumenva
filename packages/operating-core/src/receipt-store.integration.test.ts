import { describe, expect, it } from "vitest";
import { Pool } from "../../../apps/crm/node_modules/pg";
import { createPostgresExecutionReceiptStore } from "./receipt-store.js";
import type { ReceiptInput } from "./receipt-store.js";

const databaseUrl = process.env.OPERATING_CORE_TEST_DATABASE_URL;
const integration = databaseUrl ? describe : describe.skip;

const base: ReceiptInput = {
  organizationId: "11111111-1111-1111-1111-111111111111",
  executionId: "exec-concurrent",
  jobId: "job-concurrent",
  action: "job.complete",
  status: "SUCCEEDED",
  actorId: "worker-a",
  policyVersion: "policy-v1",
  permissionLevel: "P2",
  riskLevel: "R1",
  idempotencyKey: "idem-concurrent",
  result: { completed: true },
  evidenceRefs: ["evidence-concurrent"],
  createdAt: "2026-09-13T00:00:00.000Z",
};

integration("Wave 1 receipt Postgres integration", () => {
  it("coalesces concurrent writes into one tenant-scoped receipt", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      const store = createPostgresExecutionReceiptStore(pool);
      const receipts = await Promise.all(
        Array.from({ length: 16 }, (_, index) =>
          store.save({ ...base, id: `concurrent-${index}` }),
        ),
      );
      expect(new Set(receipts.map((receipt) => receipt.id)).size).toBe(1);
      const result = await pool.query(
        "select count(*)::int as count from public.operating_core_receipts where organization_id = $1 and idempotency_key = $2",
        [base.organizationId, base.idempotencyKey],
      );
      expect(result.rows[0]?.count).toBe(1);
    } finally {
      await pool.end();
    }
  });
});
