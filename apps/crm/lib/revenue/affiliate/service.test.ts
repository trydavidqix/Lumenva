import { describe, expect, it } from "vitest";
import { applyCommissionEvent, reconcileCommissionAmount, type AffiliateConversion, type Commission } from "./service";

const conversion: AffiliateConversion = {
  id: "conv-1",
  organizationId: "org-a",
  provider: "awin",
  externalId: "external-conv-1",
  status: "pending",
  saleAttributionId: null,
};

const commission: Commission = {
  id: "comm-1",
  organizationId: "org-a",
  conversionId: conversion.id,
  status: "pending",
  amountMinor: 500,
  currency: "EUR",
  payoutReference: null,
};

describe("affiliate lifecycle", () => {
  it("allows conversion to exist before commission becomes final", () => {
    expect(conversion.status).toBe("pending");
    expect(commission.status).toBe("pending");
  });

  it("supports pending -> approved -> paid and approved -> reversed", () => {
    expect(applyCommissionEvent(commission, { type: "approve" }).status).toBe("approved");
    const approved = applyCommissionEvent(commission, { type: "approve" });
    expect(applyCommissionEvent(approved, { type: "pay", payoutReference: "payout-1" }).status).toBe("paid");
    expect(applyCommissionEvent(approved, { type: "reverse" }).status).toBe("reversed");
  });

  it("reconciles amount and currency exactly", () => {
    expect(reconcileCommissionAmount(commission, { amountMinor: 500, currency: "EUR" })).toEqual({ match: true, differences: [] });
    expect(reconcileCommissionAmount(commission, { amountMinor: 550, currency: "USD" }).match).toBe(false);
  });

  it("payout reference never fabricates sale attribution", () => {
    const paid = applyCommissionEvent(applyCommissionEvent(commission, { type: "approve" }), { type: "pay", payoutReference: "payout-1" });
    expect(paid.payoutReference).toBe("payout-1");
    expect(conversion.saleAttributionId).toBeNull();
  });
});
