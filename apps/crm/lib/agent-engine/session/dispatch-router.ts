/** Minimal provider-free dispatch decision boundary. */

export type DispatchTask = {
  task_id: string;
  organization_id: string;
  actor_id: string;
  actor_capabilities: string[];
  required_capability: string;
};

export type DispatchWorker = {
  worker_id: string;
  agent_id: string;
  organization_id: string;
  capabilities: string[];
  available: boolean;
};

export type DispatchPolicy = {
  organization_id: string;
  actor_id: string;
  allowed_actor_capabilities: string[];
  allowed_worker_ids?: string[];
};

export type DispatchDecision =
  | { decision: "ALLOW"; worker_id: string; agent_id: string }
  | { decision: "DENY"; reason: "ACTOR_UNAUTHORIZED" | "NO_CAPABLE_WORKER" | "NO_POLICY_MATCH" };

/** Routes only after actor authority, tenant, capability and worker availability checks. */
export function dispatchRoute(
  task: DispatchTask,
  workers: readonly DispatchWorker[],
  policy: DispatchPolicy,
): DispatchDecision {
  if (!task || !policy || task.organization_id !== policy.organization_id) {
    return { decision: "DENY", reason: "NO_POLICY_MATCH" };
  }
  if (
    typeof task.actor_id !== "string" ||
    task.actor_id.length === 0 ||
    task.actor_id !== policy.actor_id ||
    !Array.isArray(task.actor_capabilities) ||
    !Array.isArray(policy.allowed_actor_capabilities) ||
    typeof task.required_capability !== "string" ||
    task.required_capability.length === 0 ||
    !task.actor_capabilities.includes(task.required_capability) ||
    !policy.allowed_actor_capabilities.includes(task.required_capability)
  ) {
    return { decision: "DENY", reason: "ACTOR_UNAUTHORIZED" };
  }
  if (!Array.isArray(workers)) {
    return { decision: "DENY", reason: "NO_CAPABLE_WORKER" };
  }

  const capable = workers.filter((worker) =>
    worker &&
    worker.organization_id === task.organization_id &&
    worker.available === true &&
    Array.isArray(worker.capabilities) &&
    worker.capabilities.includes(task.required_capability),
  );
  if (capable.length === 0) {
    return { decision: "DENY", reason: "NO_CAPABLE_WORKER" };
  }

  const allowed = policy.allowed_worker_ids;
  const candidates = capable
    .filter((worker) => allowed === undefined || allowed.includes(worker.worker_id))
    .sort((left, right) =>
      left.worker_id.localeCompare(right.worker_id) || left.agent_id.localeCompare(right.agent_id),
    );
  if (candidates.length === 0) {
    return { decision: "DENY", reason: "NO_POLICY_MATCH" };
  }

  const selected = candidates[0];
  return { decision: "ALLOW", worker_id: selected.worker_id, agent_id: selected.agent_id };
}

export { claimActiveSession, SessionSupersessionError } from "./postgres-session-supersession";
