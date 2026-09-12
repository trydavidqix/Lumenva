/** Provider-free Event -> Workforce -> wake decision. */

export type WakeEvent = {
  event_id: string;
  organization_id: string;
  required_capability: string;
  payload: unknown;
};

export type WakeWorker = {
  worker_id: string;
  agent_id: string;
  organization_id: string;
  capabilities: string[];
  available: boolean;
};

export type WakePolicy = {
  organization_id: string;
  allowed_worker_ids?: string[];
};

export type WakeDecision =
  | { status: "WAKED"; event_id: string; worker_id: string; agent_id: string }
  | { status: "QUEUED"; event: WakeEvent; reason: "NO_CAPABLE_WORKER" | "NO_POLICY_MATCH" };

/** Returns a queueable decision; it never throws for an unmatched event. */
export function wakeEvent(
  event: WakeEvent,
  workers: readonly WakeWorker[],
  policy: WakePolicy,
): WakeDecision {
  if (!event || !policy || event.organization_id !== policy.organization_id) {
    return { status: "QUEUED", event, reason: "NO_POLICY_MATCH" };
  }
  if (typeof event.required_capability !== "string" || event.required_capability.length === 0 || !Array.isArray(workers)) {
    return { status: "QUEUED", event, reason: "NO_CAPABLE_WORKER" };
  }

  const capable = workers.filter((worker) =>
    worker && worker.organization_id === event.organization_id && worker.available === true &&
    Array.isArray(worker.capabilities) && worker.capabilities.includes(event.required_capability),
  );
  if (capable.length === 0) return { status: "QUEUED", event, reason: "NO_CAPABLE_WORKER" };

  const allowed = policy.allowed_worker_ids;
  const candidates = capable.filter((worker) => allowed === undefined || allowed.includes(worker.worker_id)).sort((a, b) => a.worker_id.localeCompare(b.worker_id) || a.agent_id.localeCompare(b.agent_id));
  if (candidates.length === 0) return { status: "QUEUED", event, reason: "NO_POLICY_MATCH" };

  const worker = candidates[0];
  return { status: "WAKED", event_id: event.event_id, worker_id: worker.worker_id, agent_id: worker.agent_id };
}
