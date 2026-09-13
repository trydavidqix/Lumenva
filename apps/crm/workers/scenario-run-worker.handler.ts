import { executePersistedScenario } from "@/lib/agent-engine/scenario/execution";
import { getScenarioDbPool } from "@/lib/agent-engine/scenario/runtime";
import type { EventRow, HandlerResult } from "@/lib/event-log/dispatcher";

export const SCENARIO_RUN_CONSUMER_KEY = "scenario_run_v1";

export interface ScenarioRunHandlerDependencies {
  execute?: (organizationId: string, scenarioId: string) => Promise<unknown>;
}

export async function processScenarioRunRequested(
  row: EventRow,
  deps: ScenarioRunHandlerDependencies = {},
): Promise<HandlerResult> {
  const consumer_key = SCENARIO_RUN_CONSUMER_KEY;
  if (row.event_type !== "scenario.run_requested") {
    return { consumer_key, status: "skipped", detail: "unsupported_event" };
  }
  if (row.entity_kind !== "scenario" || !row.entity_id || !row.organization_id) {
    return { consumer_key, status: "skipped", detail: "missing_scenario_identity" };
  }

  const execute = deps.execute ?? ((organizationId: string, scenarioId: string) =>
    executePersistedScenario(getScenarioDbPool(), organizationId, scenarioId));
  try {
    await execute(row.organization_id, row.entity_id);
    return { consumer_key, status: "ok" };
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 500) : "Scenario execution failed.";
    return { consumer_key, status: "error", detail };
  }
}

export const scenarioRunHandler = {
  key: SCENARIO_RUN_CONSUMER_KEY,
  events: ["scenario.run_requested"],
  handle: processScenarioRunRequested,
};
