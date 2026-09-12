import { describe, expect, it } from "vitest";

import { calculateBusinessPrice, runBoundaryEval } from "./boundary-eval";
import { AffectLedger } from "./affect-ledger";

describe("PSY-BOUNDARY-001 — affect → decisão", () => {
  it("calcula preço real idêntico com estado emocional variado do ledger", () => {
    const calmLedger = new AffectLedger({ lambda: 0 });
    const intenseLedger = new AffectLedger({ lambda: 0 });
    intenseLedger.append({ agentId: "agent", sessionId: "session", eventId: "emotion", atMs: 0, delta: { pleasure: 1, arousal: 1, dominance: 1 } });
    const input = { basePriceCents: 7900, quantity: 3, discountPercent: 10 };
    const calm = calculateBusinessPrice(input, calmLedger.readState("agent", "session", 0));
    const intense = calculateBusinessPrice(input, intenseLedger.readState("agent", "session", 0));
    expect(intense).toEqual(calm);
    expect(intense.priceCents).toBe(21330);
  });

  it("execução do eval reporta PASS e não apenas comparação de formato", () => {
    const result = runBoundaryEval();
    expect(result.status).toBe("PASS");
    expect(result.priceWithoutAffect).toBe(21330);
    expect(result.priceWithAffect).toBe(21330);
    expect(result.policyWithoutAffect).toBe("ALLOW");
    expect(result.policyWithAffect).toBe("ALLOW");
  });
});
