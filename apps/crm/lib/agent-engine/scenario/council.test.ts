import { describe, expect, it } from "vitest";

import type { CouncilMemberAdapter } from "./council";
import { createGovernedCouncil } from "./council";

const baseInput = {
  organizationId: "org-a",
  scenarioId: "scenario-a",
  question: "Should price change?",
  evidence: [],
  maxCandidates: 3,
};

describe("GovernedCouncil", () => {
  it("preserves member provenance and disagreements while limiting candidates", async () => {
    const members: CouncilMemberAdapter[] = [
      {
        id: "alpha",
        async propose() {
          return {
            candidates: [
              { name: "A", description: "a", parameters: {}, assumptions: [], risks: [], evidenceRefs: [] },
              { name: "B", description: "b", parameters: {}, assumptions: [], risks: [], evidenceRefs: [] },
            ],
            disagreements: ["price elasticity uncertain"],
            synthesis: "alpha synthesis",
          };
        },
        async challenge() { return { challenges: [], missingEvidence: [], fragileAssumptions: [] }; },
        async review() { return { summary: "ok", disagreements: [], criticalAssumptions: [], nextValidationSteps: [] }; },
      },
      {
        id: "beta",
        async propose() {
          return {
            candidates: [
              { name: "C", description: "c", parameters: {}, assumptions: [], risks: [], evidenceRefs: [] },
              { name: "D", description: "d", parameters: {}, assumptions: [], risks: [], evidenceRefs: [] },
            ],
            disagreements: [],
            synthesis: "beta synthesis",
          };
        },
        async challenge() { return { challenges: [], missingEvidence: [], fragileAssumptions: [] }; },
        async review() { return { summary: "ok", disagreements: [], criticalAssumptions: [], nextValidationSteps: [] }; },
      },
    ];

    const council = createGovernedCouncil(members, { maxMembers: 2, maxRuntimeMs: 10_000 });
    const result = await council.propose(baseInput);

    expect(result.candidates).toHaveLength(3);
    expect(result.disagreements).toContain("price elasticity uncertain");
    expect(result.memberProvenance.map((member) => member.memberId)).toEqual(["alpha", "beta"]);
  });

  it("degrades when a member fails instead of failing the whole council", async () => {
    const members: CouncilMemberAdapter[] = [
      {
        id: "broken",
        async propose() { throw new Error("offline"); },
        async challenge() { throw new Error("offline"); },
        async review() { throw new Error("offline"); },
      },
      {
        id: "healthy",
        async propose() {
          return {
            candidates: [{ name: "A", description: "a", parameters: {}, assumptions: [], risks: [], evidenceRefs: [] }],
            disagreements: [],
            synthesis: "healthy",
          };
        },
        async challenge() { return { challenges: ["check demand"], missingEvidence: [], fragileAssumptions: [] }; },
        async review() { return { summary: "healthy", disagreements: [], criticalAssumptions: [], nextValidationSteps: [] }; },
      },
    ];

    const council = createGovernedCouncil(members, { maxMembers: 2, maxRuntimeMs: 10_000 });
    const result = await council.propose(baseInput);

    expect(result.candidates).toHaveLength(1);
    expect(result.memberProvenance.find((member) => member.memberId === "broken")?.status).toBe("failed");
    expect(result.memberProvenance.find((member) => member.memberId === "healthy")?.status).toBe("ok");
  });
});
