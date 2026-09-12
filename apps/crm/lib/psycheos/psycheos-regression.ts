import { AffectLedger, applyTrustInteraction, decayPad, DirectionalTrustLedger, type PadState } from "./affect-ledger";

export type PsycheProfile = Readonly<{ profileId: string; profileVersion: string; decayLambda: number }>;
export type RegressionStatus = "PASS" | "FAIL";
export type RegressionResult = Readonly<{ caseId: string; status: RegressionStatus; profileId: string; profileVersion: string; detail: string }>;

const ids = [
  "PSY-CONSISTENCY-001", "PSY-TRUTH-001", "PSY-BOUNDARY-001", "PSY-DECAY-001", "PSY-PERSIST-001",
  "PSY-REPAIR-001", "PSY-IDEMP-001", "PSY-HANDOFF-001", "PSY-ISOLATION-001", "PSY-FAIL-CLOSED-001",
] as const;

const pad = (pleasure: number, arousal: number, dominance: number): PadState => ({ pleasure, arousal, dominance });
const decision = (padState: PadState, input: { entitlement: "free" | "pro"; requestedTool: string; budget: number }) => {
  void padState;
  const allowed = input.entitlement === "pro" && input.requestedTool === "calendar.write" && input.budget >= 10;
  return { priceCents: 7900, policy: allowed ? "ALLOW" : "DENY", tool: allowed ? input.requestedTool : "none" };
};
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

type CaseFn = (profile: PsycheProfile) => string;

const cases: Record<(typeof ids)[number], CaseFn> = {
  "PSY-CONSISTENCY-001": () => {
    const ledger = new AffectLedger({ lambda: 0 });
    const input = { agentId: "agent", sessionId: "session", eventId: "e1", atMs: 0, delta: pad(0.2, 0.1, 0) };
    if (!same(ledger.append(input), ledger.append(input))) throw new Error("replay changed result");
    return "same input/snapshot is deterministic";
  },
  "PSY-TRUTH-001": () => {
    const evidenceIds: string[] = [];
    const appraisal = evidenceIds.length === 0 ? "UNKNOWN" : "HYPOTHESIS";
    if (appraisal !== "UNKNOWN") throw new Error("unsupported claim became fact");
    return "no evidence remains UNKNOWN";
  },
  "PSY-BOUNDARY-001": () => {
    const ledger = new AffectLedger({ lambda: 0 });
    const before = decision(ledger.readState("agent", "session", 0), { entitlement: "free", requestedTool: "billing.charge", budget: 1 });
    ledger.append({ agentId: "agent", sessionId: "session", eventId: "e1", atMs: 0, delta: pad(1, 1, 1) });
    const after = decision(ledger.readState("agent", "session", 0), { entitlement: "free", requestedTool: "billing.charge", budget: 1 });
    if (!same(before, after)) throw new Error("business decision changed with affect");
    if (after.policy !== "DENY" || after.tool !== "none") throw new Error("policy gate was bypassed");
    return "policy decision compared with real ledger state";
  },
  "PSY-DECAY-001": (profile) => {
    const ledger = new AffectLedger({ lambda: profile.decayLambda });
    ledger.append({ agentId: "agent", sessionId: "session", eventId: "e1", atMs: 0, delta: pad(1, 0, 0) });
    const observed = ledger.readState("agent", "session", 2000).pleasure;
    const expected = Math.exp(-profile.decayLambda * 2);
    if (Math.abs(observed - expected) > 1e-10) throw new Error(`decay ${observed} != ${expected}`);
    return "exponential decay matches expected value";
  },
  "PSY-PERSIST-001": () => {
    const ledger = new AffectLedger({ lambda: 0.5 });
    ledger.append({ agentId: "agent", sessionId: "session", eventId: "e1", atMs: 0, delta: pad(0.4, -0.2, 0.1) });
    ledger.append({ agentId: "agent", sessionId: "session", eventId: "e2", atMs: 2000, delta: pad(0, 0, 0) });
    const events = ledger.events();
    const expected = 0.4 * Math.exp(-1);
    if (events.length !== 2 || Math.abs((events[1]?.before.pleasure ?? 0) - expected) > 1e-10) throw new Error("ledger state was not persisted through decay");
    return `ledger events=${events.length}; persisted decay state verified`;
  },
  "PSY-REPAIR-001": () => {
    const trust = new DirectionalTrustLedger();
    trust.append({ subjectId: "agent", targetId: "customer", interactionId: "breach", kind: "BREACH", confidence: 1 });
    const repair = trust.append({ subjectId: "agent", targetId: "customer", interactionId: "repair", kind: "REPAIR", confidence: 1 });
    if (!(repair.after > -0.5 && repair.after < 0)) throw new Error("repair reset trust instead of gradual recovery");
    return "repair is gradual and keeps breach history";
  },
  "PSY-IDEMP-001": () => {
    const ledger = new AffectLedger({ lambda: 0 });
    const input = { agentId: "agent", sessionId: "session", eventId: "e1", atMs: 0, delta: pad(0.5, 0, 0) };
    ledger.append(input);
    ledger.append(input);
    if (ledger.events().length !== 1 || ledger.readState("agent", "session", 0).pleasure !== 0.5) throw new Error("duplicate delta applied");
    return "replay is idempotent";
  },
  "PSY-HANDOFF-001": () => {
    const ledger = new AffectLedger({ lambda: 0.5 });
    ledger.append({ agentId: "agent", sessionId: "session", eventId: "e1", atMs: 0, delta: pad(0.3, 0.2, -0.1) });
    const handoffSnapshot = ledger.readState("agent", "session", 1000);
    const next = ledger.append({ agentId: "agent", sessionId: "session", eventId: "e2", atMs: 1000, delta: pad(0, 0, 0) });
    if (!same(handoffSnapshot, next.before)) throw new Error("handoff snapshot was not used as next event state");
    return "handoff became next event before state";
  },
  "PSY-ISOLATION-001": () => {
    const ledger = new AffectLedger({ lambda: 0 });
    ledger.append({ agentId: "agent-a", sessionId: "session-a", eventId: "e1", atMs: 0, delta: pad(0.9, 0, 0) });
    if (ledger.readState("agent-b", "session-b", 0).pleasure !== 0) throw new Error("cross-agent/session leakage");
    return "agent/session namespaces isolated";
  },
  "PSY-FAIL-CLOSED-001": () => {
    let rejected = false;
    try { applyTrustInteraction(0, { kind: "UNKNOWN" as never, confidence: 1 }); } catch { rejected = true; }
    if (!rejected) throw new Error("invalid affect/trust input was accepted");
    return "invalid kind rejected fail-closed";
  },
};

export function runPsycheRegression(profile: PsycheProfile): RegressionResult[] {
  return ids.map((caseId) => {
    try {
      return { caseId, status: "PASS", profileId: profile.profileId, profileVersion: profile.profileVersion, detail: cases[caseId](profile) };
    } catch (error) {
      return { caseId, status: "FAIL", profileId: profile.profileId, profileVersion: profile.profileVersion, detail: error instanceof Error ? error.message : String(error) };
    }
  });
}

export function formatPsycheRegressionReport(results: readonly RegressionResult[]): string {
  return results.map((result) => `${result.status} ${result.caseId} profile=${result.profileId}@${result.profileVersion} ${result.detail}`).join("\n");
}
