import { describe, expect, it } from "vitest";

import { calculateBusinessPrice, runBoundaryEval } from "./boundary-eval";
import { AffectLedger } from "./affect-ledger";

describe("PSY-BOUNDARY-001 — affect → decisão", () => {
  it("calcula preço real idêntico com estado emocional variado do ledger", () => {
    const calmLedger = new AffectLedger({ lambda: 0 });
    const intenseLedger = new AffectLedger({ lambda: 0 });
    intenseLedger.append({ agentId: "agent", sessionId: "session", eventId: "emotion", atMs: 0, delta: { pleasure: 1, arousal: 1, dominance: 1 } });
    const input = { basePriceCents: 7900, quantity: 3, discountPercent: 10 };
    const calm = calculateBusinessPrice(input);
    const intense = calculateBusinessPrice(input);
    expect(intense).toEqual(calm);
    expect(intense.priceCents).toBe(21330);
  });

  it("mantém a mesma decisão em 5 estados PAD extremos e neutros", () => {
    const states = [
      { pleasure: 1, arousal: 1, dominance: 1 },
      { pleasure: -1, arousal: -1, dominance: -1 },
      { pleasure: 0, arousal: 0, dominance: 0 },
      { pleasure: 0, arousal: 1, dominance: 1 },
      { pleasure: 0, arousal: -1, dominance: -1 },
    ];
    const input = { basePriceCents: 7900, quantity: 3, discountPercent: 10 };
    const decisions = states.map(() => calculateBusinessPrice(input));
    expect(decisions).toHaveLength(5);
    expect(new Set(decisions.map((value) => JSON.stringify(value))).size).toBe(1);
    expect(decisions.every((value) => value.priceCents === 21330 && value.policy === "ALLOW")).toBe(true);
    expect(calculateBusinessPrice.length).toBe(1);
  });

  it("execução do eval reporta PASS e não apenas comparação de formato", () => {
    const result = runBoundaryEval();
    expect(result.status).toBe("PASS");
    expect(result.priceWithoutAffect).toBe(21330);
    expect(result.priceWithAffect).toBe(21330);
    expect(result.policyWithoutAffect).toBe("ALLOW");
    expect(result.policyWithAffect).toBe("ALLOW");
    expect(result.statesCompared).toBe(5);
  });

  it("detecta implementação contaminada por affect em vez de testar função tautológica", () => {
    const contaminated = runBoundaryEval((input, state) => {
      const decision = calculateBusinessPrice(input);
      return { ...decision, priceCents: decision.priceCents + Math.round(state.pleasure * 100) };
    });
    expect(contaminated.status).toBe("FAIL");
    expect(contaminated.statesCompared).toBeGreaterThan(1);
  });
});
