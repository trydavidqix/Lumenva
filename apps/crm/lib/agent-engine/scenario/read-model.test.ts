import { describe, expect, it, vi } from "vitest";

import { loadScenarioWorkspace } from "./read-model";

describe("loadScenarioWorkspace", () => {
  it("keeps every workspace read tenant-scoped and exposes setup plus latest results", async () => {
    const query = vi.fn(async (sql: string) => {
      if (/from\s+scenario_definitions/i.test(sql)) return { rows: [{ id: "scenario-1", organization_id: "org-a", question: "q", status: "COMPLETED" }] };
      if (/from\s+scenario_evidence/i.test(sql)) return { rows: [{ id: "e-1", source_kind: "observed_fact", authority: "authoritative_crm", source_type: "crm", source_ref: "metric:1", observed_at: null, retrieved_at: "2026-09-13T10:00:00Z", content: {}, provenance: {} }] };
      if (/from\s+scenario_assumptions/i.test(sql)) return { rows: [] };
      if (/from\s+scenario_strategies/i.test(sql)) return { rows: [{ id: "s-1", name: "Baseline", description: "", parameters: {}, is_baseline: true, source: "system", evidence_refs: [] }] };
      if (/from\s+scenario_actor_templates/i.test(sql)) return { rows: [] };
      if (/from\s+scenario_runs/i.test(sql)) return { rows: [{ id: "r-1", strategy_id: "s-1", status: "COMPLETED", seed: 11, engine: "mock", engine_version: "mock@1", started_at: null, ended_at: null }] };
      if (/from\s+scenario_reports/i.test(sql)) return { rows: [{ id: "report-1", recommendation: "validate", confidence_composite: null, confidence_components: {}, strongest_effects: [], uncertainty: [], segment_impacts: [], critical_assumptions: [], sensitivity_findings: [], council_disagreements: [], evidence_coverage: 0, next_validation_steps: [], provenance: {}, created_at: "2026-09-13T10:00:01Z" }] };
      throw new Error(`unexpected query ${sql}`);
    });

    const workspace = await loadScenarioWorkspace({ query }, "org-a", "scenario-1");

    expect(workspace?.scenario.id).toBe("scenario-1");
    expect(workspace?.strategies[0]?.isBaseline).toBe(true);
    expect(workspace?.latestReport?.id).toBe("report-1");
    for (const [sql, values] of query.mock.calls) {
      expect(String(sql)).toMatch(/organization_id\s*=\s*\$1/i);
      expect(values).toEqual(["org-a", "scenario-1"]);
    }
  });

  it("stops after the scenario lookup when the tenant cannot see the scenario", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const workspace = await loadScenarioWorkspace({ query }, "org-a", "scenario-x");
    expect(workspace).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
