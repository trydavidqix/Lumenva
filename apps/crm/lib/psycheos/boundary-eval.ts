import { AffectLedger, type PadState } from "./affect-ledger";

export type PricingInput = Readonly<{ basePriceCents: number; quantity: number; discountPercent: number }>;
export type BusinessDecision = Readonly<{ priceCents: number; policy: "ALLOW" | "DENY"; tool: "none" }>;
export type BoundaryEvalResult = Readonly<{
  status: "PASS" | "FAIL";
  priceWithoutAffect: number;
  priceWithAffect: number;
  policyWithoutAffect: BusinessDecision["policy"];
  policyWithAffect: BusinessDecision["policy"];
}>;

/** Business calculation is deliberately independent from PAD/affect. */
export function calculateBusinessPrice(input: PricingInput, _affectState: PadState): BusinessDecision {
  if (!Number.isInteger(input.basePriceCents) || input.basePriceCents < 0 || !Number.isInteger(input.quantity) || input.quantity < 1) {
    return { priceCents: 0, policy: "DENY", tool: "none" };
  }
  if (!Number.isFinite(input.discountPercent) || input.discountPercent < 0 || input.discountPercent > 100) {
    return { priceCents: 0, policy: "DENY", tool: "none" };
  }
  const priceCents = Math.round(input.basePriceCents * input.quantity * (1 - input.discountPercent / 100));
  return { priceCents, policy: priceCents > 0 ? "ALLOW" : "DENY", tool: "none" };
}

export function runBoundaryEval(): BoundaryEvalResult {
  const calmLedger = new AffectLedger({ lambda: 0 });
  const intenseLedger = new AffectLedger({ lambda: 0 });
  intenseLedger.append({ agentId: "agent", sessionId: "session", eventId: "emotion", atMs: 0, delta: { pleasure: 1, arousal: 1, dominance: 1 } });
  const input = { basePriceCents: 7900, quantity: 3, discountPercent: 10 };
  const withoutAffect = calculateBusinessPrice(input, calmLedger.readState("agent", "session", 0));
  const withAffect = calculateBusinessPrice(input, intenseLedger.readState("agent", "session", 0));
  const status = withoutAffect.priceCents === withAffect.priceCents && withoutAffect.policy === withAffect.policy ? "PASS" : "FAIL";
  return {
    status,
    priceWithoutAffect: withoutAffect.priceCents,
    priceWithAffect: withAffect.priceCents,
    policyWithoutAffect: withoutAffect.policy,
    policyWithAffect: withAffect.policy,
  };
}
