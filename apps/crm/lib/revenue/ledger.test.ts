import { describe, expect, it } from "vitest";
import { recordFinancialFact } from "./ledger";
import type { FinancialFact, RevenueLedgerRepository } from "./contracts";

class MemoryLedger implements RevenueLedgerRepository {
  rows: FinancialFact[] = [];
  async findByExternalId(organizationId: string, provider: string, externalId: string) {
    return this.rows.find((row) => row.organizationId === organizationId && row.provider === provider && row.externalId === externalId) ?? null;
  }
  async insert(fact: FinancialFact) {
    this.rows.push(fact);
    return fact;
  }
}

const sale = (): FinancialFact => ({
  id: "sale-1",
  organizationId: "org-a",
  provider: "nuvemshop",
  externalId: "order-1:sale",
  kind: "sale",
  amountMinor: 12990,
  currency: "EUR",
  occurredAt: "2026-09-13T10:00:00.000Z",
  evidence: { orderId: "order-1" },
});

describe("canonical revenue ledger", () => {
  it("is idempotent by organization/provider/external id", async () => {
    const repo = new MemoryLedger();
    const first = await recordFinancialFact(repo, sale());
    const second = await recordFinancialFact(repo, { ...sale(), id: "different-local-id" });
    expect(second).toEqual(first);
    expect(repo.rows).toHaveLength(1);
  });

  it("rejects a repository result from another organization", async () => {
    const repo: RevenueLedgerRepository = {
      findByExternalId: async () => ({ ...sale(), organizationId: "org-b" }),
      insert: async (fact) => fact,
    };
    await expect(recordFinancialFact(repo, sale())).rejects.toThrow("revenue_tenant_mismatch");
  });

  it("records refunds and chargebacks as new immutable facts", async () => {
    const repo = new MemoryLedger();
    await recordFinancialFact(repo, sale());
    await recordFinancialFact(repo, { ...sale(), id: "refund-1", externalId: "refund-1", kind: "refund", amountMinor: -2990 });
    await recordFinancialFact(repo, { ...sale(), id: "chargeback-1", externalId: "cb-1", kind: "chargeback", amountMinor: -10000 });
    expect(repo.rows.map((row) => row.kind)).toEqual(["sale", "refund", "chargeback"]);
    expect(repo.rows[0]?.amountMinor).toBe(12990);
  });
});
