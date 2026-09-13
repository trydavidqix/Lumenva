import { describe, expect, it } from "vitest";
import {
  InMemoryExecutionReceiptStore,
  createPostgresExecutionReceiptStore,
  type ReceiptInput,
} from "./receipt-store.js";

const input: ReceiptInput = {
  organizationId: "org-a",
  executionId: "exec-1",
  jobId: "job-1",
  action: "job.complete",
  status: "SUCCEEDED",
  actorId: "worker-a",
  policyVersion: "policy-v1",
  permissionLevel: "P2",
  riskLevel: "R1",
  idempotencyKey: "idem-1",
  result: { completed: true },
  evidenceRefs: ["evidence-1"],
  createdAt: "2026-09-13T00:00:00.000Z",
};

describe("Wave 1 execution receipts", () => {
  it("persists a tenant-scoped receipt and makes replay idempotent", async () => {
    const store = new InMemoryExecutionReceiptStore();
    const first = await store.save({ ...input, id: "receipt-1" });
    const replay = await store.save({ ...input, id: "receipt-2", result: { changed: true } });
    expect(replay).toEqual(first);
    await expect(store.get("org-a", "receipt-1")).resolves.toMatchObject({ organizationId: "org-a", evidenceRefs: ["evidence-1"] });
  });

  it("rejects cross-tenant reads and does not collide idempotency keys across tenants", async () => {
    const store = new InMemoryExecutionReceiptStore();
    await store.save({ ...input, id: "receipt-a" });
    const other = await store.save({ ...input, id: "receipt-b", organizationId: "org-b" });
    expect(other.id).toBe("receipt-b");
    await expect(store.get("org-b", "receipt-a")).rejects.toThrow("receipt_tenant_mismatch");
  });

  it("fails closed when the receipt boundary is incomplete", async () => {
    const store = new InMemoryExecutionReceiptStore();
    await expect(store.save({ ...input, organizationId: "" })).rejects.toThrow("receipt_required");
    await expect(store.save({ ...input, idempotencyKey: "" })).rejects.toThrow("receipt_required");
  });

  it("uses tenant-scoped ON CONFLICT upsert and tenant-scoped reads in Postgres", async () => {
    const calls: Array<{ text: string; values?: readonly unknown[] }> = [];
    const db = {
      async query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]) {
        calls.push({ text, values });
        return { rows: [{ ...input, id: "receipt-1" }] as T[] };
      },
    };
    const store = createPostgresExecutionReceiptStore(db);
    await store.save({ ...input, id: "receipt-1" });
    await store.get("org-a", "receipt-1");
    expect(calls[0]?.text).toContain("on conflict (organization_id, idempotency_key)");
    expect(calls[1]?.text).toContain("where organization_id = $1 and id = $2");
    expect(calls[1]?.values).toEqual(["org-a", "receipt-1"]);
  });
});
