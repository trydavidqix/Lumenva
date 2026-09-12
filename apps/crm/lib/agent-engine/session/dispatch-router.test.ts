import { describe, expect, it } from "vitest";
import { dispatchRoute, type DispatchPolicy, type DispatchTask, type DispatchWorker } from "./dispatch-router";

const task: DispatchTask = {
  task_id: "task-1",
  organization_id: "org-1",
  required_capability: "crm.read",
};
const policy: DispatchPolicy = {
  organization_id: "org-1",
  allowed_worker_ids: ["worker-b", "worker-a"],
};
const workers: DispatchWorker[] = [
  { worker_id: "worker-b", agent_id: "agent-b", organization_id: "org-1", capabilities: ["crm.read"] },
  { worker_id: "worker-a", agent_id: "agent-a", organization_id: "org-1", capabilities: ["crm.read", "crm.write"] },
];

describe("DispatchRouter", () => {
  it("routes to a capable worker allowed by policy deterministically", () => {
    expect(dispatchRoute(task, workers, policy)).toEqual({
      decision: "ALLOW",
      worker_id: "worker-a",
      agent_id: "agent-a",
    });
  });

  it("fails closed when no worker has the required capability", () => {
    expect(dispatchRoute({ ...task, required_capability: "billing.write" }, workers, policy)).toEqual({
      decision: "DENY",
      reason: "NO_CAPABLE_WORKER",
    });
  });

  it("fails closed for tenant or policy mismatch", () => {
    expect(dispatchRoute(task, [{ ...workers[0], organization_id: "org-2" }], policy)).toEqual({
      decision: "DENY",
      reason: "NO_CAPABLE_WORKER",
    });
    expect(dispatchRoute(task, workers, { ...policy, allowed_worker_ids: ["worker-c"] })).toEqual({
      decision: "DENY",
      reason: "NO_POLICY_MATCH",
    });
  });
});
