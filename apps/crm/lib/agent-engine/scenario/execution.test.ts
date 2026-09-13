import { describe, expect, it, vi } from "vitest";
import type pg from "pg";

import type { ScenarioOrchestrationResult } from "./orchestrator";
import { executePersistedScenario } from "./execution";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SCENARIO = "11111111-1111-4111-8111-111111111111";
const BASELINE = "22222222-2222-4222-8222-222222222222";
const ALT_A = "33333333-3333-4333-8333-333333333333";
const ALT_B = "44444444-4444-4444-8444-444444444444";
const TEMPLATE = "55555555-5555-4555-8555-555555555555";
const RUN = "66666666-6666-4666-8666-666666666666";

function orchestrationResult(): ScenarioOrchestrationResult {
  return {
    proposal: { candidates: [], disagreements: [], memberProvenance: [], synthesis: "" },
    challenge: { challenges: [], missingEvidence: [], fragileAssumptions: [], memberProvenance: [] },
    review: {
      summary: "review",
      recommendation: "validate",
      disagreements: [],
      criticalAssumptions: [],
      nextValidationSteps: ["test"],
      memberProvenance: [],
    },
    councilRounds: [],
    strategies: [],
    runs: [{
      id: RUN,
      organizationId: ORG,
      scenarioId: SCENARIO,
      strategyId: BASELINE,
      populationId: `population:${SCENARIO}:11`,
      status: "COMPLETED",
      seed: 11,
      engine: "mock",
      engineVersion: "mock@1",
      compilerVersion: "scenario-compiler@1",
      budget: { rounds: 8 },
      startedAt: "2026-09-13T10:00:00.000Z",
      endedAt: "2026-09-13T10:00:01.000Z",
    }],
    artifacts: [{
      provenance: { synthetic: true, scenarioId: SCENARIO, runId: RUN, seed: 11, engineVersion: "mock@1", evidenceRefs: [] },
      events: [{ kind: "mock.completed", occurredAt: "2026-09-13T10:00:01.000Z", payload: { rounds: 8 } }],
      outcomes: [{ key: "mock_strategy_signal", value: 0.1 }],
      metrics: { mock_strategy_signal: 0.1 },
    }],
    evaluation: {
      scenarioId: SCENARIO,
      runCount: 1,
      failedRunCount: 0,
      strategyRanking: [{ strategyId: BASELINE, score: 0.1, stable: true }],
      metrics: [{ key: "mock_strategy_signal", strategyId: BASELINE, mean: 0.1, median: 0.1, p10: 0.1, p90: 0.1, variance: 0, directionConsistency: 1 }],
      sensitivity: [],
      evidenceCoverage: 0,
      generatedAt: "2026-09-13T10:00:01.000Z",
    },
    brief: {
      scenarioId: SCENARIO,
      question: "Should we change price?",
      baselineStrategyId: BASELINE,
      comparedStrategyIds: [BASELINE, ALT_A, ALT_B],
      strongestEffects: ["synthetic effect"],
      uncertainty: ["not calibrated"],
      segmentImpacts: [],
      criticalAssumptions: [],
      sensitivityFindings: [],
      councilDisagreements: [],
      evidenceCoverage: 0,
      confidence: {
        components: {
          runStability: 1,
          evidenceCoverage: 0,
          modelAgreement: 1,
          sensitivityStability: 0.5,
          historicalCalibration: null,
          engineReliability: 1,
          dataFreshness: 0,
        },
        composite: null,
        formulaVersion: "scenario-confidence@1",
        reasons: ["No historical calibration."],
      },
      recommendation: "validate",
      nextValidationSteps: ["test"],
      provenance: { runIds: [RUN], evidenceRefs: [] },
    },
  };
}

function fakePool() {
  const rootQuery = vi.fn(async (sql: string, values?: unknown[]) => {
    if (/from\s+scenario_definitions/i.test(sql)) return { rows: [{
      id: SCENARIO, organization_id: ORG, question: "Should we change price?", status: "RUNNING",
      decision_variables: { baseline: { price: 49 } }, constraints: {},
      budget: { maxCouncilRounds: 1, maxSimulationRuns: 15, maxRuntimeMs: 120000, maxFailedRuns: 2, noProgressLimit: 1 },
      compiler_version: "scenario-compiler@1",
    }] };
    if (/from\s+scenario_evidence/i.test(sql)) return { rows: [] };
    if (/from\s+scenario_assumptions/i.test(sql)) return { rows: [] };
    if (/from\s+scenario_strategies/i.test(sql)) return { rows: [
      { id: BASELINE, organization_id: ORG, scenario_id: SCENARIO, name: "Baseline", description: "", parameters: { price: 49 }, is_baseline: true, source: "system", evidence_refs: [] },
      { id: ALT_A, organization_id: ORG, scenario_id: SCENARIO, name: "A", description: "", parameters: { price: 59 }, is_baseline: false, source: "council", evidence_refs: [] },
      { id: ALT_B, organization_id: ORG, scenario_id: SCENARIO, name: "B", description: "", parameters: { price: 79 }, is_baseline: false, source: "council", evidence_refs: [] },
    ] };
    if (/from\s+scenario_actor_templates/i.test(sql)) return { rows: [{
      id: TEMPLATE, organization_id: ORG, scenario_id: SCENARIO, key: "general_customer", label: "General", weight: 1,
      traits: {}, incentives: {}, constraints: {}, evidence_refs: [],
    }] };
    throw new Error(`unexpected root query: ${sql} ${JSON.stringify(values)}`);
  });
  const txQuery = vi.fn(async (sql: string) => {
    if (/update\s+scenario_definitions/i.test(sql)) return { rows: [{ id: SCENARIO }] };
    return { rows: [] };
  });
  const connect = vi.fn(async () => ({ query: txQuery, release: vi.fn() }));
  return { pool: { query: rootQuery, connect } as unknown as pg.Pool, rootQuery, txQuery };
}

describe("executePersistedScenario", () => {
  it("persists synthetic populations, runs, artifacts, comparison and report before marking COMPLETED", async () => {
    const { pool, rootQuery, txQuery } = fakePool();
    const orchestrate = vi.fn().mockResolvedValue(orchestrationResult());

    const result = await executePersistedScenario(pool, ORG, SCENARIO, { orchestrate, id: () => "77777777-7777-4777-8777-777777777777" });

    expect(result.status).toBe("COMPLETED");
    expect(orchestrate).toHaveBeenCalledTimes(1);
    for (const call of rootQuery.mock.calls) {
      const sql = String(call[0]);
      if (/^\s*select/i.test(sql)) expect(sql).toMatch(/organization_id\s*=\s*\$1/i);
    }
    const sql = txQuery.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).toMatch(/insert into scenario_populations/i);
    expect(sql).toMatch(/insert into scenario_runs/i);
    expect(sql).toMatch(/insert into scenario_run_events/i);
    expect(sql).toMatch(/insert into scenario_outcomes/i);
    expect(sql).toMatch(/insert into scenario_metrics/i);
    expect(sql).toMatch(/insert into scenario_comparisons/i);
    expect(sql).toMatch(/insert into scenario_reports/i);
    expect(sql).toMatch(/status\s*=\s*\$4/i);
    expect(txQuery.mock.calls.some((call) => Array.isArray(call[1]) && call[1]?.[3] === "ANALYZING")).toBe(true);
    expect(txQuery.mock.calls.some((call) => Array.isArray(call[1]) && call[1]?.[3] === "COMPLETED")).toBe(true);
    expect(sql).toMatch(/insert into event_log/i);
  });

  it("refuses to execute a scenario that was not moved to RUNNING by the request endpoint", async () => {
    const { pool, rootQuery, txQuery } = fakePool();
    rootQuery.mockImplementation(async (sql: string) => {
      if (/from\s+scenario_definitions/i.test(sql)) return { rows: [{ id: SCENARIO, organization_id: ORG, question: "q", status: "READY", decision_variables: {}, constraints: {}, budget: {} }] };
      return { rows: [] };
    });

    await expect(executePersistedScenario(pool, ORG, SCENARIO, { orchestrate: vi.fn() })).rejects.toThrow(/expected RUNNING/i);
    expect(txQuery).not.toHaveBeenCalled();
  });
});
