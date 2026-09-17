import { describe, expect, it } from "vitest";
import { decidePhase4Gate } from "./metrics";
import type { AgentEvalResult } from "../apps/crm/lib/agent-engine/evals/contracts";

const completeSupervisorResult: AgentEvalResult = {
  caseId: "case-1",
  caseVersion: "v1",
  agentId: "supervisor",
  source: "golden",
  assertions: [{ kind: "structured_output", severity: "hard_gate", passed: true, evidence: "valid" }],
};

describe("Phase 4 eval gate", () => {
  it("does not promote when an applicable agent has no eval result", () => {
    const historicalSamplesByAgent = new Map([
      ["supervisor", 10], ["atendimento", 10], ["sales", 10], ["retention", 10],
      ["escalation", 10], ["crm_operator", 10],
    ]) as never;
    expect(decidePhase4Gate({
      results: [completeSupervisorResult],
      criticalEscalationRecall: 1,
      minimumHistoricalSamplesPerAgent: 1,
      historicalSamplesByAgent,
    }).decision).toBe("INCOMPLETE");
  });
});
