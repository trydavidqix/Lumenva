import { describe, expect, it, vi } from "vitest";

import { createScenarioRepository } from "./repository";

describe("ScenarioRepository", () => {
  it("derives every read from an explicit organization id", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const repo = createScenarioRepository({ query });

    await repo.listScenarios("org-a", 20);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/where\s+organization_id\s*=\s*\$1/i);
    expect(values[0]).toBe("org-a");
  });

  it("creates the scenario and lifecycle event atomically", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: "scenario-1", organization_id: "org-a", question: "test", status: "DRAFT" }],
    });
    const repo = createScenarioRepository({ query });

    await repo.createScenario("org-a", {
      question: "What happens if price changes?",
      decisionVariables: {},
      constraints: {},
      budget: {},
    });

    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/insert into scenario_definitions/i);
    expect(sql).toMatch(/insert into event_log/i);
    expect(sql).toMatch(/'scenario.created'/i);
    expect(values[0]).toBe("org-a");
  });

  it("uses expected status for optimistic lifecycle transitions", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "scenario-1", status: "EVIDENCE_READY" }] });
    const repo = createScenarioRepository({ query });

    await repo.transitionScenario("org-a", "scenario-1", "DRAFT", "EVIDENCE_READY");

    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/status\s*=\s*\$3/i);
    expect(sql).toMatch(/organization_id\s*=\s*\$2/i);
    expect(values).toEqual(["scenario-1", "org-a", "DRAFT", "EVIDENCE_READY"]);
  });
});
