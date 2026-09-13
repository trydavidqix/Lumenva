import { createHmac, timingSafeEqual } from "node:crypto";

/** Provider-free Event -> Workforce -> wake decision. HMAC is a shared-secret fixture, not production signing. */
import type { PostgresWakeEventStore } from "./event-idempotency";
export type WakeEvent = {
  event_id: string; organization_id: string; actor_id: string; actor_capabilities: string[]; required_capability: string;
  idempotency_key: string; payload: unknown; signature?: string;
};
export type WakeWorker = { worker_id: string; agent_id: string; organization_id: string; capabilities: string[]; available: boolean };
export type WakePolicy = { organization_id: string; allowed_worker_ids?: string[] };
export type WakeDecision =
  | { status: "WAKED"; event_id: string; worker_id: string; agent_id: string }
  | { status: "QUEUED"; event: WakeEvent; reason: "NO_CAPABLE_WORKER" | "NO_POLICY_MATCH" }
  | { status: "DUPLICATE"; event_id: string; reason: "IDEMPOTENT_REPLAY" }
  | { status: "REJECTED"; reason: "INVALID_EVENT" | "INVALID_SIGNATURE" };

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => key !== "signature").sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalize(item)]));
  return value;
}
function digest(event: Omit<WakeEvent, "signature">, secret: string): string { return createHmac("sha256", secret).update(JSON.stringify(canonicalize(event))).digest("hex"); }
export function signWakeEvent(event: Omit<WakeEvent, "signature">, secret: string): WakeEvent { return { ...event, signature: digest(event, secret) }; }
export function verifyWakeEventSignature(event: WakeEvent, secret: string): boolean {
  if (!event.signature || !secret) return false;
  const expected = Buffer.from(digest(event, secret), "hex"); const received = Buffer.from(event.signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
function isValidEvent(event: unknown): event is WakeEvent {
  if (!event || typeof event !== "object") return false; const candidate = event as Partial<WakeEvent>;
  return typeof candidate.event_id === "string" && !!candidate.event_id && typeof candidate.organization_id === "string" && !!candidate.organization_id && typeof candidate.actor_id === "string" && !!candidate.actor_id && Array.isArray(candidate.actor_capabilities) && candidate.actor_capabilities.length > 0 && candidate.actor_capabilities.every((item) => typeof item === "string" && !!item) && typeof candidate.required_capability === "string" && !!candidate.required_capability && candidate.actor_capabilities.includes(candidate.required_capability) && typeof candidate.idempotency_key === "string" && !!candidate.idempotency_key && Object.prototype.hasOwnProperty.call(candidate, "payload");
}
/** Validates schema and HMAC before routing; invalid origin never falls into QUEUED. */
export function wakeEvent(event: unknown, workers: readonly WakeWorker[], policy: WakePolicy, secret: string): WakeDecision {
  if (!isValidEvent(event)) return { status: "REJECTED", reason: "INVALID_EVENT" };
  if (!verifyWakeEventSignature(event, secret)) return { status: "REJECTED", reason: "INVALID_SIGNATURE" };
  if (!policy || event.organization_id !== policy.organization_id) return { status: "QUEUED", event, reason: "NO_POLICY_MATCH" };
  if (!Array.isArray(workers)) return { status: "QUEUED", event, reason: "NO_CAPABLE_WORKER" };
  const capable = workers.filter((worker) => worker && worker.organization_id === event.organization_id && worker.available === true && Array.isArray(worker.capabilities) && worker.capabilities.includes(event.required_capability));
  if (capable.length === 0) return { status: "QUEUED", event, reason: "NO_CAPABLE_WORKER" };
  const allowed = policy.allowed_worker_ids; const candidates = capable.filter((worker) => allowed === undefined || allowed.includes(worker.worker_id)).sort((a, b) => a.worker_id.localeCompare(b.worker_id) || a.agent_id.localeCompare(b.agent_id));
  if (candidates.length === 0) return { status: "QUEUED", event, reason: "NO_POLICY_MATCH" };
  const worker = candidates[0]; return { status: "WAKED", event_id: event.event_id, worker_id: worker.worker_id, agent_id: worker.agent_id };
}

export async function wakeEventPersisted(event: unknown, workers: readonly WakeWorker[], policy: WakePolicy, secret: string, store: PostgresWakeEventStore): Promise<WakeDecision> {
  const decision = wakeEvent(event, workers, policy, secret);
  if (decision.status === "REJECTED") return decision;
  const claimed = await store.claim(event as WakeEvent);
  if (!claimed) return { status: "DUPLICATE", event_id: (event as WakeEvent).event_id, reason: "IDEMPOTENT_REPLAY" };
  return decision;
}
