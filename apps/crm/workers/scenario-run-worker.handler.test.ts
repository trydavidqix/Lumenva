import { describe, expect, it, vi } from "vitest";

import type { EventRow } from "@/lib/event-log/dispatcher";
import { processScenarioRunRequested, SCENARIO_RUN_CONSUMER_KEY } from "./scenario-run-worker.handler";

const row: EventRow = {
  id: "event-1",
  organization_id: "org-a",
  event_type: "scenario.run_requested",
  entity_kind: "scenario",
  entity_id: "scenario-1",
  payload: { status: "RUNNING" },
  metadata: { synthetic: false },
  consumed_by: [],
  attempts: 0,
};

describe("scenario run event handler", () => {
  it("executes using event tenant identity and scenario entity id", async () => {
    const execute = vi.fn().mockResolvedValue({ status: "COMPLETED", reportId: "report-1" });
    const result = await processScenarioRunRequested(row, { execute });

    expect(execute).toHaveBeenCalledWith("org-a", "scenario-1");
    expect(result).toEqual(expect.objectContaining({ consumer_key: SCENARIO_RUN_CONSUMER_KEY, status: "ok" }));
  });

  it("skips malformed events without guessing tenant or scenario identity", async () => {
    const execute = vi.fn();
    const result = await processScenarioRunRequested({ ...row, entity_id: null }, { execute });

    expect(result.status).toBe("skipped");
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns error when governed execution fails", async () => {
    const execute = vi.fn().mockRejectedValue(new Error("simulation failed"));
    const result = await processScenarioRunRequested(row, { execute });

    expect(result.status).toBe("error");
    expect(result.detail).toMatch(/simulation failed/i);
  });
});
