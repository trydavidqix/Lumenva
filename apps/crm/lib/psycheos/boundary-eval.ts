import { AffectLedger } from "./affect-ledger";

export type PricingInput = Readonly<{ basePriceCents: number; quantity: number; discountPercent: number }>;
export type BusinessDecision = Readonly<{ priceCents: number; policy: "ALLOW" | "DENY"; tool: "none" }>;
export type BoundaryEvalResult = Readonly<{
  status: "PASS" | "FAIL";
  priceWithoutAffect: number;
  priceWithAffect: number;
  policyWithoutAffect: BusinessDecision["policy"];
  policyWithAffect: BusinessDecision["policy"];
  statesCompared: number;
}>;

/** Business calculation is deliberately independent from PAD/affect. */
export function calculateBusinessPrice(input: PricingInput): BusinessDecision {
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
  const deltas = [
    { pleasure: 1, arousal: 1, dominance: 1 },
    { pleasure: -1, arousal: -1, dominance: -1 },
    { pleasure: 0, arousal: 0, dominance: 0 },
    { pleasure: 0, arousal: 1, dominance: 1 },
    { pleasure: 0, arousal: -1, dominance: -1 },
  ];
  const affectStates = deltas.map((delta, index) => {
    const ledger = new AffectLedger({ lambda: 0 });
    ledger.append({ agentId: "agent", sessionId: `session-${index}`, eventId: `emotion-${index}`, atMs: 0, delta });
    return ledger.readState("agent", `session-${index}`, 0);
  });
  const input = { basePriceCents: 7900, quantity: 3, discountPercent: 10 };
  const decisions = affectStates.map(() => calculateBusinessPrice(input));
  const withoutAffect = decisions[0]!;
  const withAffect = decisions.at(-1)!;
  const status = decisions.every((value) => value.priceCents === withoutAffect.priceCents && value.policy === withoutAffect.policy) ? "PASS" : "FAIL";
  return {
    status,
    priceWithoutAffect: withoutAffect.priceCents,
    priceWithAffect: withAffect.priceCents,
    policyWithoutAffect: withoutAffect.policy,
    policyWithAffect: withAffect.policy,
    statesCompared: affectStates.length,
  };
}
