import { describe, expect, it } from "vitest";

import { compileScenario } from "./compiler";

describe("compileScenario", () => {
  it("keeps facts, assumptions and hypotheses explicitly separated", () => {
    const compiled = compileScenario({
      organizationId: "org-a",
      scenarioId: "scenario-a",
      question: "Should we raise the price?",
      compilerVersion: "scenario-compiler@1",
      evidence: [],
      assumptions: [
        {
          id: "a1",
          organizationId: "org-a",
          scenarioId: "scenario-a",
          statement: "Competitors keep current prices",
          sourceKind: "user_assumption",
          evidenceRefs: [],
        },
      ],
      strategies: [],
      actorTemplates: [],
      entities: [
        {
          id: "market-1",
          kind: "Market",
          label: "Primary market",
          attributes: {},
          provenance: {
            sourceKind: "council_hypothesis",
            evidenceRefs: [],
            createdAt: "2026-09-13T00:00:00.000Z",
          },
        },
      ],
      parameters: {},
      now: "2026-09-13T00:00:00.000Z",
    });

    expect(compiled.assumptions[0]?.sourceKind).toBe("user_assumption");
    expect(compiled.entities[0]?.provenance.sourceKind).toBe("council_hypothesis");
  });

  it("rejects cross-tenant input", () => {
    expect(() =>
      compileScenario({
        organizationId: "org-a",
        scenarioId: "scenario-a",
        question: "test",
        compilerVersion: "v1",
        evidence: [
          {
            id: "e1",
            organizationId: "org-b",
            scenarioId: "scenario-a",
            sourceKind: "observed_fact",
            authority: "authoritative_crm",
            sourceType: "crm",
            sourceRef: "lead:1",
            retrievedAt: "2026-09-13T00:00:00.000Z",
            content: {},
            provenance: {},
          },
        ],
        assumptions: [],
        strategies: [],
        actorTemplates: [],
        entities: [],
        parameters: {},
      }),
    ).toThrow(/organization mismatch/i);
  });

  it("requires at least one baseline before a runnable scenario can be compiled", () => {
    expect(() =>
      compileScenario({
        organizationId: "org-a",
        scenarioId: "scenario-a",
        question: "test",
        compilerVersion: "v1",
        evidence: [],
        assumptions: [],
        strategies: [
          {
            id: "s1",
            organizationId: "org-a",
            scenarioId: "scenario-a",
            name: "Proposal",
            description: "proposal",
            parameters: {},
            isBaseline: false,
            source: "user",
            evidenceRefs: [],
          },
        ],
        actorTemplates: [],
        entities: [],
        parameters: {},
        requireBaseline: true,
      }),
    ).toThrow(/baseline/i);
  });
});
