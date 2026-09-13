import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = (name: string) =>
  readFileSync(resolve(process.cwd(), "../../supabase/migrations", name), "utf8");

const migrationNames = [
  "20260913170000_0141_scenario_lab_core.sql",
  "20260913170100_0142_scenario_lab_simulation.sql",
  "20260913170200_0143_scenario_lab_evaluation.sql",
  "20260913170300_0144_scenario_lab_calibration.sql",
];

describe("Scenario Lab migrations", () => {
  it("keeps every scenario table tenant scoped and RLS protected", () => {
    const sql = migrationNames.map(migration).join("\n").toLowerCase();
    const tables = [
      "scenario_definitions",
      "scenario_evidence",
      "scenario_assumptions",
      "scenario_strategies",
      "scenario_actor_templates",
      "scenario_populations",
      "scenario_runs",
      "scenario_run_events",
      "scenario_agent_actions",
      "scenario_outcomes",
      "scenario_metrics",
      "scenario_comparisons",
      "scenario_reports",
      "scenario_backtests",
      "scenario_calibration",
    ];

    for (const table of tables) {
      expect(sql).toContain(`create table if not exists ${table}`);
      expect(sql).toContain(`alter table ${table} enable row level security`);
      expect(sql).toContain(`on ${table} (organization_id`);
    }
  });

  it("uses the canonical organization membership helper in RLS policies", () => {
    for (const name of migrationNames) {
      const sql = migration(name).toLowerCase();
      expect(sql).toContain("organization_id in (select fn_user_org_ids())");
    }
  });

  it("marks simulator-owned records as synthetic by construction", () => {
    const sql = [migration(migrationNames[1]), migration(migrationNames[2])].join("\n").toLowerCase();
    for (const table of ["scenario_agent_actions", "scenario_outcomes", "scenario_metrics", "scenario_reports"]) {
      const start = sql.indexOf(`create table if not exists ${table}`);
      expect(start).toBeGreaterThanOrEqual(0);
      const section = sql.slice(start, start + 1800);
      expect(section).toMatch(/synthetic\s+boolean\s+not\s+null\s+default\s+true/);
      expect(section).toMatch(/check\s*\(synthetic\s*=\s*true\)/);
    }
  });
});
