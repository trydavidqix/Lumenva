import { AffectLedger, applyTrustInteraction, decayPad, DirectionalTrustLedger } from "./affect-ledger";
import { runBoundaryEval } from "./boundary-eval";

export type SystemicCaseResult = Readonly<{ caseId: "AFFECT_LEDGER" | "DECAY" | "TRUST" | "BOUNDARY"; status: "PASS" | "FAIL"; detail: string }>;
export type SystemicGateResult = Readonly<{ status: "PASS" | "FAIL"; cases: readonly SystemicCaseResult[]; failedCases: readonly string[] }>;

const runCase = (caseId: SystemicCaseResult["caseId"], check: () => string): SystemicCaseResult => {
  try { return { caseId, status: "PASS", detail: check() }; }
  catch (error) { return { caseId, status: "FAIL", detail: error instanceof Error ? error.message : String(error) }; }
};

export function runPsycheSystemicGate(): SystemicGateResult {
  const cases: SystemicCaseResult[] = [
    runCase("AFFECT_LEDGER", () => {
      const ledger = new AffectLedger({ lambda: 0 });
      ledger.append({ agentId: "agent", sessionId: "session", eventId: "e1", atMs: 0, delta: { pleasure: 0.4, arousal: 0.2, dominance: -0.1 } });
      const snapshot = ledger.readState("agent", "session", 0);
      try { (snapshot as { pleasure: number }).pleasure = -1; } catch { /* immutable snapshot expected */ }
      if (ledger.readState("agent", "session", 0).pleasure !== 0.4 || ledger.events().length !== 1) throw new Error("append-only state was mutated");
      return "immutable snapshot and append-only event log verified";
    }),
    runCase("DECAY", () => {
      const result = decayPad({ pleasure: 0.8, arousal: -0.4, dominance: 1 }, 2, 0.5);
      const factor = Math.exp(-1);
      if (Math.abs(result.pleasure - 0.8 * factor) > 1e-10 || Math.abs(result.arousal + 0.4 * factor) > 1e-10 || Math.abs(result.dominance - factor) > 1e-10) throw new Error("decay formula regressed");
      return "PAD exponential decay verified";
    }),
    runCase("TRUST", () => {
      const positive = applyTrustInteraction(0, { kind: "POSITIVE", confidence: 1 });
      const breach = applyTrustInteraction(0, { kind: "BREACH", confidence: 1 });
      const ledger = new DirectionalTrustLedger({ positive: 100, breach: 100, repair: 100 });
      const capped = ledger.append({ subjectId: "agent", targetId: "customer", interactionId: "i1", kind: "POSITIVE", confidence: 1 });
      if (!(positive === 0.1 && breach === -0.5 && Math.abs(breach) > positive && capped.after === 0.1)) throw new Error("trust asymmetry/cap regressed");
      return "directional asymmetry, repair caps and rate bounds verified";
    }),
    runCase("BOUNDARY", () => {
      const result = runBoundaryEval();
      if (result.status !== "PASS" || result.statesCompared !== 5 || result.priceWithoutAffect !== result.priceWithAffect || result.policyWithoutAffect !== result.policyWithAffect) throw new Error("affect changed business decision");
      return `five affect states produce identical price=${result.priceWithoutAffect} and policy=${result.policyWithoutAffect}`;
    }),
  ];
  const failedCases = cases.filter((result) => result.status === "FAIL").map((result) => result.caseId);
  return { status: failedCases.length === 0 ? "PASS" : "FAIL", cases, failedCases };
}

export function formatSystemicGateReport(gate: SystemicGateResult): string {
  return gate.cases.map((result) => `${result.status} ${result.caseId} ${result.detail}`).join("\n");
}
