export type FinancialFactKind =
  | "sale"
  | "payment"
  | "refund"
  | "chargeback"
  | "commission"
  | "payout";

export interface FinancialFact {
  id: string;
  organizationId: string;
  provider: string;
  externalId: string;
  kind: FinancialFactKind;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  evidence: Record<string, unknown>;
}

export interface RevenueLedgerRepository {
  findByExternalId(
    organizationId: string,
    provider: string,
    externalId: string,
  ): Promise<FinancialFact | null>;
  insert(fact: FinancialFact): Promise<FinancialFact>;
}

export interface RevenueObservation {
  organizationId: string;
  provider: string;
  sourceExternalId: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  evidenceRefs: string[];
}
