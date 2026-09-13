export type AffiliateConversionStatus = "observed" | "pending" | "confirmed" | "reversed";
export type CommissionStatus = "pending" | "approved" | "reversed" | "paid";

export interface AffiliateConversion {
  id: string;
  organizationId: string;
  provider: string;
  externalId: string;
  status: AffiliateConversionStatus;
  saleAttributionId: string | null;
}

export interface Commission {
  id: string;
  organizationId: string;
  conversionId: string | null;
  status: CommissionStatus;
  amountMinor: number;
  currency: string;
  payoutReference: string | null;
}

export type CommissionEvent =
  | { type: "approve" }
  | { type: "reverse" }
  | { type: "pay"; payoutReference: string };

export function applyCommissionEvent(commission: Commission, event: CommissionEvent): Commission {
  if (!Number.isSafeInteger(commission.amountMinor)) throw new Error("commission_amount_must_be_integer");
  if (!/^[A-Z]{3}$/.test(commission.currency)) throw new Error("commission_currency_invalid");

  if (event.type === "approve") {
    if (commission.status !== "pending") throw new Error("commission_transition_invalid");
    return { ...commission, status: "approved" };
  }
  if (event.type === "reverse") {
    if (commission.status !== "pending" && commission.status !== "approved") throw new Error("commission_transition_invalid");
    return { ...commission, status: "reversed" };
  }
  if (commission.status !== "approved" || !event.payoutReference.trim()) throw new Error("commission_transition_invalid");
  return { ...commission, status: "paid", payoutReference: event.payoutReference };
}

export function reconcileCommissionAmount(
  commission: Commission,
  providerValue: { amountMinor: number; currency: string },
): { match: boolean; differences: string[] } {
  const differences: string[] = [];
  if (commission.amountMinor !== providerValue.amountMinor) differences.push("amount");
  if (commission.currency !== providerValue.currency) differences.push("currency");
  return { match: differences.length === 0, differences };
}
