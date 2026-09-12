import { describe, expect, it } from "vitest";

import { AffectLedger, applyTrustInteraction, decayPad, DirectionalTrustLedger, type PadDelta } from "./affect-ledger";

const delta = (pleasure: number, arousal: number, dominance: number): PadDelta => ({ pleasure, arousal, dominance });

describe("AffectLedger append-only", () => {
  it("registra PAD por agente/sessão e aplica decay antes do novo delta", () => {
    const ledger = new AffectLedger({ lambda: 0.5 });
    ledger.append({ agentId: "agent-1", sessionId: "session-1", eventId: "evt-1", atMs: 0, delta: delta(1, 0, 0) });
    const event = ledger.append({ agentId: "agent-1", sessionId: "session-1", eventId: "evt-2", atMs: 2000, delta: delta(0, 0, 0) });

    expect(event.before.pleasure).toBeCloseTo(Math.exp(-1), 8);
    expect(event.after).toEqual(event.before);
    expect(ledger.events()).toHaveLength(2);
  });

  it("não permite mutar estado anterior devolvido nem reescrever o ledger", () => {
    const ledger = new AffectLedger({ lambda: 0 });
    ledger.append({ agentId: "agent-1", sessionId: "session-1", eventId: "evt-1", atMs: 0, delta: delta(0.3, 0.2, 0.1) });
    const snapshot = ledger.readState("agent-1", "session-1", 0);

    expect(() => {
      (snapshot as { pleasure: number }).pleasure = -1;
    }).toThrow(TypeError);
    expect(ledger.readState("agent-1", "session-1", 0).pleasure).toBeCloseTo(0.3);
    expect(ledger.events()[0]?.after.pleasure).toBeCloseTo(0.3);
  });

  it("isola agentes e sessões", () => {
    const ledger = new AffectLedger({ lambda: 0 });
    ledger.append({ agentId: "agent-1", sessionId: "session-1", eventId: "evt-1", atMs: 0, delta: delta(0.8, 0, 0) });
    expect(ledger.readState("agent-1", "session-2", 0)).toEqual({ pleasure: 0, arousal: 0, dominance: 0 });
    expect(ledger.readState("agent-2", "session-1", 0)).toEqual({ pleasure: 0, arousal: 0, dominance: 0 });
  });

  it("prova que decisão de negócio (preço) não é afetada pelo PAD", () => {
    const ledger = new AffectLedger({ lambda: 0 });
    const priceDecision = (pad: Readonly<ReturnType<typeof ledger.readState>>) => ({ priceCents: 7900, approval: "REQUIRED" as const, pad });
    const calm = priceDecision(ledger.readState("agent-1", "session-1", 0));
    ledger.append({ agentId: "agent-1", sessionId: "session-1", eventId: "evt-1", atMs: 0, delta: delta(-1, 1, 1) });
    const intense = priceDecision(ledger.readState("agent-1", "session-1", 0));

    expect({ priceCents: calm.priceCents, approval: calm.approval }).toEqual({ priceCents: intense.priceCents, approval: intense.approval });
  });

  it("rejeita replay do mesmo eventId sem duplicar ou somar duas vezes", () => {
    const ledger = new AffectLedger({ lambda: 0 });
    const input = { agentId: "agent-1", sessionId: "session-1", eventId: "evt-1", atMs: 0, delta: delta(0.4, 0, 0) };
    const first = ledger.append(input);
    const replay = ledger.append(input);
    expect(replay).toEqual(first);
    expect(ledger.events()).toHaveLength(1);
    expect(ledger.readState("agent-1", "session-1", 0).pleasure).toBeCloseTo(0.4);
  });

  it("aplica decay exponencial matematicamente correto por eixo", () => {
    const result = decayPad({ pleasure: 0.8, arousal: -0.4, dominance: 1 }, 2, 0.5);
    const factor = Math.exp(-1);
    expect(result.pleasure).toBeCloseTo(0.8 * factor, 10);
    expect(result.arousal).toBeCloseTo(-0.4 * factor, 10);
    expect(result.dominance).toBeCloseTo(factor, 10);
  });

  it("com decay=0 (esquecimento zero), affect não altera preço nem policy", () => {
    const ledger = new AffectLedger({ lambda: 0 });
    const decide = (pad: ReturnType<typeof ledger.readState>) => ({ priceCents: 7900, policy: "REQUIRES_APPROVAL", pad });
    const before = decide(ledger.readState("agent-1", "session-1", 0));
    ledger.append({ agentId: "agent-1", sessionId: "session-1", eventId: "evt-zero-decay", atMs: 0, delta: delta(1, -1, 1) });
    const after = decide(ledger.readState("agent-1", "session-1", 86_400_000));
    expect({ priceCents: before.priceCents, policy: before.policy }).toEqual({ priceCents: after.priceCents, policy: after.policy });
  });

  it("trust direcional sobe devagar e cai mais rápido numa quebra", () => {
    const positive = applyTrustInteraction(0, { kind: "POSITIVE", confidence: 1 });
    const breach = applyTrustInteraction(0, { kind: "BREACH", confidence: 1 });
    expect(positive).toBeCloseTo(0.1);
    expect(breach).toBeCloseTo(-0.5);
    expect(Math.abs(breach)).toBeGreaterThan(Math.abs(positive));
  });

  it("repair/forgiveness recupera gradualmente, sem apagar a quebra", () => {
    const ledger = new DirectionalTrustLedger();
    ledger.append({ subjectId: "agent-1", targetId: "customer-1", interactionId: "i-1", kind: "BREACH", confidence: 1 });
    const firstRepair = ledger.append({ subjectId: "agent-1", targetId: "customer-1", interactionId: "i-2", kind: "REPAIR", confidence: 1 });
    const secondRepair = ledger.append({ subjectId: "agent-1", targetId: "customer-1", interactionId: "i-3", kind: "REPAIR", confidence: 1 });
    expect(firstRepair.after).toBeCloseTo(-0.45);
    expect(secondRepair.after).toBeCloseTo(-0.4);
    expect(secondRepair.after).toBeLessThan(0);
    expect(ledger.events()).toHaveLength(3);
  });

  it("mantém trust direcional: A→B não altera B→A", () => {
    const ledger = new DirectionalTrustLedger();
    ledger.append({ subjectId: "agent-a", targetId: "customer-b", interactionId: "i-1", kind: "POSITIVE", confidence: 1 });
    expect(ledger.read("agent-a", "customer-b")).toBeCloseTo(0.1);
    expect(ledger.read("customer-b", "agent-a")).toBeCloseTo(0);
  });
});
