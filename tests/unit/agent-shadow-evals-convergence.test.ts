import { describe, expect, it } from "vitest";

import { evaluateDeterministicAssertions } from "../../lib/agent-engine/evals/assertions";
import { getPhase4GoldenCases } from "../../lib/agent-engine/evals/datasets";
import { combineDeterministicAndQuality } from "../../lib/agent-engine/evals/quality-judge";

function safeObservation(overrides: Partial<Parameters<typeof evaluateDeterministicAssertions>[0]> = {}) {
  return {
    organizationId: "org-a",
    expectedOrganizationId: "org-a",
    output: { ok: true },
    outputValid: true,
    selectedToolIds: [],
    forbiddenToolIds: [],
    policyDenied: false,
    executedSideEffects: 0,
    requiresCriticalEscalation: false,
    producedCriticalEscalation: false,
    crossTenantAttempted: false,
    invalidOutputCompleted: false,
    r4AutonomousAttempted: false,
    ...overrides,
  };
}

describe("converged SHADOW evals", () => {
  it("includes every Product Agent and the security/failure synthetic cases", () => {
    const cases = getPhase4GoldenCases();
    const agents = new Set(cases.map((item) => item.agentId));

    expect([...agents].sort()).toEqual([
      "atendimento",
      "crm_operator",
      "escalation",
      "governance_judge",
      "retention",
      "sales",
      "supervisor",
    ].sort());
    expect(cases.some((item) => item.tags.includes("cross_tenant"))).toBe(true);
    expect(cases.some((item) => item.tags.includes("r4"))).toBe(true);
    expect(cases.some((item) => item.tags.includes("provider_failure"))).toBe(true);
  });

  it("fails hard when SHADOW produces a side effect", () => {
    const assertions = evaluateDeterministicAssertions(safeObservation({ executedSideEffects: 1 }));
    const gate = assertions.find((item) => item.kind === "shadow_zero_side_effects");

    expect(gate).toMatchObject({ severity: "hard_gate", passed: false });
  });

  it("fails hard on cross-tenant observation", () => {
    const assertions = evaluateDeterministicAssertions(safeObservation({
      organizationId: "org-b",
      crossTenantAttempted: true,
    }));

    expect(assertions.find((item) => item.kind === "tenant_scope")?.passed).toBe(false);
    expect(assertions.find((item) => item.kind === "cross_tenant_isolation")?.passed).toBe(false);
  });

  it("never lets a quality judge override a failed deterministic hard gate", () => {
    const deterministic = evaluateDeterministicAssertions(safeObservation({ r4AutonomousAttempted: true }));
    const combined = combineDeterministicAndQuality({
      deterministic,
      quality: { available: true, score: 1, passed: true, evidence: ["judge says excellent"] },
    });

    expect(combined.passed).toBe(false);
  });
});
