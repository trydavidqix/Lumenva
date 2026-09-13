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

  it("edits mutable fields only while a scenario remains DRAFT", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: "scenario-1", status: "DRAFT", question: "updated" }] });
    const repo = createScenarioRepository({ query });

    await repo.updateDraft("org-a", "scenario-1", { question: "updated", constraints: { region: "PT" } });

    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/status\s*=\s*'DRAFT'/i);
    expect(sql).toMatch(/'scenario\.updated'/i);
    expect(values[0]).toBe("scenario-1");
    expect(values[1]).toBe("org-a");
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

  it("moves READY to RUNNING and emits one async run request in the same statement", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: "scenario-1", organization_id: "org-a", status: "RUNNING", run_request_event_id: "event-1" }],
    });
    const repo = createScenarioRepository({ query });

    const result = await repo.requestRun("org-a", "scenario-1", "req-1");

    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/status\s*=\s*'RUNNING'/i);
    expect(sql).toMatch(/status\s*=\s*'READY'/i);
    expect(sql).toMatch(/'scenario\.run_requested'/i);
    expect(sql).toMatch(/insert into event_log/i);
    expect(values).toEqual(["scenario-1", "org-a", "req-1"]);
    expect(result.run_request_event_id).toBe("event-1");
  });

  it("loads the latest decision report only inside the trusted organization scope", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ id: "report-2", scenario_id: "scenario-1", organization_id: "org-a" }],
    });
    const repo = createScenarioRepository({ query });

    const report = await repo.getLatestReport("org-a", "scenario-1");

    const [sql, values] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/from\s+scenario_reports/i);
    expect(sql).toMatch(/organization_id\s*=\s*\$1/i);
    expect(sql).toMatch(/scenario_id\s*=\s*\$2/i);
    expect(sql).toMatch(/order by\s+created_at\s+desc/i);
    expect(sql).toMatch(/limit\s+1/i);
    expect(values).toEqual(["org-a", "scenario-1"]);
    expect(report?.id).toBe("report-2");
  });
});
