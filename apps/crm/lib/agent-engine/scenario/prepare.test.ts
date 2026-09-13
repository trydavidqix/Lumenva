import { describe, expect, it, vi } from "vitest";
import type pg from "pg";

import type { CouncilPort } from "../contracts/scenario";
import { prepareScenario } from "./prepare";

function fakeCouncil(): CouncilPort {
  return {
    propose: vi.fn().mockResolvedValue({
      candidates: [
        { name: "A", description: "A", parameters: { price: 59 }, assumptions: ["a1"], risks: [], evidenceRefs: [] },
        { name: "B", description: "B", parameters: { price: 79 }, assumptions: ["a2"], risks: [], evidenceRefs: [] },
      ],
      disagreements: [],
      memberProvenance: [{ memberId: "test", status: "ok" }],
      synthesis: "two alternatives",
    }),
    challenge: vi.fn().mockResolvedValue({
      challenges: ["validate elasticity"],
      missingEvidence: ["historical conversion"],
      fragileAssumptions: ["demand remains stable"],
      memberProvenance: [{ memberId: "test", status: "ok" }],
    }),
    review: vi.fn(),
  };
}

function fakePool() {
  const rootQuery = vi.fn(async (sql: string, values?: unknown[]) => {
    if (/from\s+scenario_definitions/i.test(sql)) {
      return {
        rows: [{
          id: "11111111-1111-4111-8111-111111111111",
          organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          question: "Should price change?",
          status: "DRAFT",
          decision_variables: { baseline: { price: 49 } },
          constraints: {},
          budget: { maxCouncilRounds: 2, maxSimulationRuns: 15, maxRuntimeMs: 120000, maxFailedRuns: 2, noProgressLimit: 1 },
        }],
      };
    }
    if (/from\s+scenario_evidence/i.test(sql)) return { rows: [] };
    throw new Error(`unexpected root query: ${sql} ${JSON.stringify(values)}`);
  });
  const txQuery = vi.fn(async () => ({ rows: [] }));
  const release = vi.fn();
  const connect = vi.fn(async () => ({ query: txQuery, release }));
  return {
    pool: { query: rootQuery, connect } as unknown as pg.Pool,
    rootQuery,
    txQuery,
    release,
  };
}

describe("prepareScenario", () => {
  it("turns a tenant-scoped DRAFT into a READY scenario with baseline, Council alternatives and synthetic actor template", async () => {
    const { pool, rootQuery, txQuery, release } = fakePool();
    const council = fakeCouncil();

    const result = await prepareScenario(
      pool,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "11111111-1111-4111-8111-111111111111",
      { council, id: (() => {
        let n = 0;
        return () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
      })() },
    );

    expect(rootQuery.mock.calls[0]?.[0]).toMatch(/organization_id\s*=\s*\$1/i);
    expect(rootQuery.mock.calls[0]?.[1]).toEqual([
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "11111111-1111-4111-8111-111111111111",
    ]);
    expect(council.propose).toHaveBeenCalledWith(expect.objectContaining({ maxCandidates: 2 }));
    expect(result.status).toBe("READY");
    expect(result.strategies).toHaveLength(3);
    expect(result.strategies.filter((strategy) => strategy.isBaseline)).toHaveLength(1);
    expect(result.actorTemplates).toHaveLength(1);

    const sql = txQuery.mock.calls.map((call) => String(call[0])).join("\n");
    expect(sql).toMatch(/insert into scenario_strategies/i);
    expect(sql).toMatch(/insert into scenario_actor_templates/i);
    expect(sql).toMatch(/status\s*=\s*'EVIDENCE_READY'/i);
    expect(sql).toMatch(/status\s*=\s*'COMPILED'/i);
    expect(sql).toMatch(/status\s*=\s*'READY'/i);
    expect(sql).toMatch(/insert into event_log/i);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("refuses preparation when the scenario is outside DRAFT", async () => {
    const { pool, rootQuery, txQuery } = fakePool();
    rootQuery.mockImplementation(async (sql: string) => {
      if (/from\s+scenario_definitions/i.test(sql)) {
        return { rows: [{ id: "scenario", organization_id: "org", question: "q", status: "RUNNING", decision_variables: {}, constraints: {}, budget: {} }] };
      }
      return { rows: [] };
    });

    await expect(prepareScenario(pool, "org", "scenario", { council: fakeCouncil() })).rejects.toThrow(/expected DRAFT/i);
    expect(txQuery).not.toHaveBeenCalled();
  });
});
