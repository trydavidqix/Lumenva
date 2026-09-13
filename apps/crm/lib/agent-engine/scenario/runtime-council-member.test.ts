import { describe, expect, it, vi } from "vitest";

import { createRuntimeCouncilMember } from "./runtime-council-member";

describe("Runtime Council member", () => {
  it("uses the injected canonical model seam and preserves usage provenance", async () => {
    const callModel = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        candidates: [{ name: "A", description: "test", parameters: { price: 59 }, assumptions: [], risks: [], evidenceRefs: [] }],
        disagreements: ["uncertain elasticity"],
        synthesis: "Test a smaller increase first.",
      }),
      provider: "test-provider",
      model: "test-model",
      tokens: 123,
      costCents: 4,
    });
    const member = createRuntimeCouncilMember({ id: "planner", callModel });

    const result = await member.propose({
      organizationId: "org-a",
      scenarioId: "scenario-a",
      question: "Raise price?",
      evidence: [],
      maxCandidates: 3,
    });

    expect(callModel).toHaveBeenCalledTimes(1);
    expect(callModel.mock.calls[0]?.[0]).toMatchObject({ organizationId: "org-a", purpose: "scenario_council_propose" });
    expect(result.candidates[0]?.name).toBe("A");
    expect(result.tokens).toBe(123);
    expect(member.provider).toBe("test-provider");
    expect(member.model).toBe("test-model");
  });

  it("fails closed on malformed structured output", async () => {
    const member = createRuntimeCouncilMember({
      id: "planner",
      callModel: async () => ({ text: "not-json", provider: "p", model: "m", tokens: 1, costCents: 0 }),
    });
    await expect(member.propose({
      organizationId: "org-a", scenarioId: "scenario-a", question: "test", evidence: [], maxCandidates: 2,
    })).rejects.toThrow(/structured json/i);
  });
});
