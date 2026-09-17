import { describe, expect, it } from "vitest";
import { dispatchRoute, type DispatchPolicy, type DispatchTask, type DispatchWorker } from "./dispatch-router";

const task: DispatchTask = {
  task_id: "task-1",
  organization_id: "org-1",
  actor_id: "actor-1",
  actor_capabilities: ["crm.read"],
  required_capability: "crm.read",
};
const policy: DispatchPolicy = {
  organization_id: "org-1",
  actor_id: "actor-1",
  allowed_actor_capabilities: ["crm.read"],
  allowed_worker_ids: ["worker-b", "worker-a"],
};
const workers: DispatchWorker[] = [
  { worker_id: "worker-b", agent_id: "agent-b", organization_id: "org-1", capabilities: ["crm.read"], available: true },
  { worker_id: "worker-a", agent_id: "agent-a", organization_id: "org-1", capabilities: ["crm.read", "crm.write"], available: true },
];

describe("DispatchRouter", () => {
  it("routes to a capable worker allowed by policy deterministically", () => {
    expect(dispatchRoute(task, workers, policy)).toEqual({ decision: "ALLOW", worker_id: "worker-a", agent_id: "agent-a" });
  });

  it("denies an absent actor", () => {
    expect(dispatchRoute({ ...task, actor_id: "" }, workers, policy)).toEqual({ decision: "DENY", reason: "ACTOR_UNAUTHORIZED" });
  });

  it("rejects a payload with no actor identity", () => {
    expect(dispatchRoute({ ...task, actor_id: undefined as unknown as string }, workers, policy)).toEqual({ decision: "DENY", reason: "ACTOR_UNAUTHORIZED" });
  });

  it("rejects a payload with no policy actor identity", () => {
    expect(dispatchRoute(task, workers, { ...policy, actor_id: undefined as unknown as string })).toEqual({ decision: "DENY", reason: "ACTOR_UNAUTHORIZED" });
  });

  it("rejects a payload with no policy capability grant", () => {
    expect(dispatchRoute(task, workers, { ...policy, allowed_actor_capabilities: undefined as unknown as string[] })).toEqual({ decision: "DENY", reason: "ACTOR_UNAUTHORIZED" });
  });

  it("denies whitespace-only actor identity instead of treating it as authenticated", () => {
    expect(dispatchRoute({ ...task, actor_id: "   " }, workers, { ...policy, actor_id: "   " })).toEqual({ decision: "DENY", reason: "ACTOR_UNAUTHORIZED" });
  });

  it("denies whitespace-only policy identity instead of treating it as a valid policy", () => {
    expect(dispatchRoute(task, workers, { ...policy, actor_id: "   " })).toEqual({ decision: "DENY", reason: "ACTOR_UNAUTHORIZED" });
  });

  it("denies a capability not authorized for the actor", () => {
    expect(dispatchRoute({ ...task, required_capability: "crm.write" }, workers, policy)).toEqual({ decision: "DENY", reason: "ACTOR_UNAUTHORIZED" });
  });

  it("denies workers whose available flag is undefined", () => {
    expect(dispatchRoute(task, [{ ...workers[0]!, available: undefined as unknown as boolean }], policy)).toEqual({ decision: "DENY", reason: "NO_CAPABLE_WORKER" });
  });

  it("fails closed when no worker has the required capability", () => {
    expect(dispatchRoute({ ...task, required_capability: "billing.write", actor_capabilities: ["billing.write"] }, workers, { ...policy, allowed_actor_capabilities: ["billing.write"] })).toEqual({ decision: "DENY", reason: "NO_CAPABLE_WORKER" });
  });

  it("fails closed for tenant or policy mismatch", () => {
    expect(dispatchRoute(task, [{ ...workers[0]!, organization_id: "org-2" }], policy)).toEqual({ decision: "DENY", reason: "NO_CAPABLE_WORKER" });
    expect(dispatchRoute(task, workers, { ...policy, allowed_worker_ids: ["worker-c"] })).toEqual({ decision: "DENY", reason: "NO_POLICY_MATCH" });
  });
});
