import type { FinancialFact, RevenueLedgerRepository } from "./contracts";

function assertFact(fact: FinancialFact): void {
  if (!fact.organizationId || !fact.provider || !fact.externalId) {
    throw new Error("revenue_identity_required");
  }
  if (!Number.isSafeInteger(fact.amountMinor)) {
    throw new Error("revenue_amount_must_be_minor_integer");
  }
  if (!/^[A-Z]{3}$/.test(fact.currency)) {
    throw new Error("revenue_currency_invalid");
  }
}

export async function recordFinancialFact(
  repository: RevenueLedgerRepository,
  fact: FinancialFact,
): Promise<FinancialFact> {
  assertFact(fact);
  const existing = await repository.findByExternalId(
    fact.organizationId,
    fact.provider,
    fact.externalId,
  );
  if (existing) {
    if (existing.organizationId !== fact.organizationId) {
      throw new Error("revenue_tenant_mismatch");
    }
    return existing;
  }
  const inserted = await repository.insert({ ...fact, evidence: { ...fact.evidence } });
  if (inserted.organizationId !== fact.organizationId) {
    throw new Error("revenue_tenant_mismatch");
  }
  return inserted;
}
