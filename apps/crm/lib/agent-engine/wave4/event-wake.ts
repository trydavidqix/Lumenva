/** Provider-free Event -> Workforce -> wake decision. */

export type WakeEvent = {
  event_id: string;
  organization_id: string;
  actor_id: string;
  actor_capabilities: string[];
  required_capability: string;
  idempotency_key: string;
  payload: unknown;
  /** Opaque signature is carried only; cryptographic verification is PRECISA_DONO. */
  signature?: string;
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
  | { status: "QUEUED"; event: WakeEvent; reason: "NO_CAPABLE_WORKER" | "NO_POLICY_MATCH" }
  | { status: "REJECTED"; reason: "INVALID_EVENT" };

function isValidEvent(event: unknown): event is WakeEvent {
  if (!event || typeof event !== "object") return false;
  const candidate = event as Partial<WakeEvent>;
  return typeof candidate.event_id === "string" && candidate.event_id.length > 0 &&
    typeof candidate.organization_id === "string" && candidate.organization_id.length > 0 &&
    typeof candidate.actor_id === "string" && candidate.actor_id.length > 0 &&
    Array.isArray(candidate.actor_capabilities) && candidate.actor_capabilities.length > 0 &&
    candidate.actor_capabilities.every((capability) => typeof capability === "string" && capability.length > 0) &&
    typeof candidate.required_capability === "string" && candidate.required_capability.length > 0 &&
    candidate.actor_capabilities.includes(candidate.required_capability) &&
    typeof candidate.idempotency_key === "string" && candidate.idempotency_key.length > 0 &&
    Object.prototype.hasOwnProperty.call(candidate, "payload");
}

/**
 * Validates the envelope before routing. Idempotency presence is enforced;
 * replay storage and cryptographic signature verification are PRECISA_DONO.
 */
export function wakeEvent(
  event: unknown,
  workers: readonly WakeWorker[],
  policy: WakePolicy,
): WakeDecision {
  if (!isValidEvent(event)) return { status: "REJECTED", reason: "INVALID_EVENT" };
  if (!policy || event.organization_id !== policy.organization_id) {
    return { status: "QUEUED", event, reason: "NO_POLICY_MATCH" };
  }
  if (!Array.isArray(workers)) return { status: "QUEUED", event, reason: "NO_CAPABLE_WORKER" };

  const capable = workers.filter((worker) =>
    worker && worker.organization_id === event.organization_id && worker.available === true &&
    Array.isArray(worker.capabilities) && worker.capabilities.includes(event.required_capability),
  );
  if (capable.length === 0) return { status: "QUEUED", event, reason: "NO_CAPABLE_WORKER" };

  const allowed = policy.allowed_worker_ids;
  const candidates = capable
    .filter((worker) => allowed === undefined || allowed.includes(worker.worker_id))
    .sort((a, b) => a.worker_id.localeCompare(b.worker_id) || a.agent_id.localeCompare(b.agent_id));
  if (candidates.length === 0) return { status: "QUEUED", event, reason: "NO_POLICY_MATCH" };

  const worker = candidates[0];
  return { status: "WAKED", event_id: event.event_id, worker_id: worker.worker_id, agent_id: worker.agent_id };
}
