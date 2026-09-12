import { describe, expect, it } from "vitest";
import { wakeEvent, type WakeEvent, type WakePolicy, type WakeWorker } from "./event-wake";

const event: WakeEvent = { event_id: "event-1", organization_id: "org-1", actor_id: "actor-1", actor_capabilities: ["browser.open"], required_capability: "browser.open", idempotency_key: "event-1-replay", payload: { url: "https://example.test" } };
const policy: WakePolicy = { organization_id: "org-1", allowed_worker_ids: ["worker-1"] };
const workers: WakeWorker[] = [{ worker_id: "worker-1", agent_id: "agent-1", organization_id: "org-1", capabilities: ["browser.open"], available: true }];

describe("EventWake", () => {
  it("wakes the deterministic capable worker allowed by policy", () => {
    expect(wakeEvent(event, workers, policy)).toEqual({ status: "WAKED", event_id: "event-1", worker_id: "worker-1", agent_id: "agent-1" });
  });

  it("rejects an event with an absent actor", () => {
    expect(wakeEvent({ ...event, actor_id: "" }, workers, policy)).toEqual({ status: "REJECTED", reason: "INVALID_EVENT" });
  });

  it("rejects an event whose actor lacks the requested capability", () => {
    expect(wakeEvent({ ...event, required_capability: "browser.upload" }, workers, policy)).toEqual({ status: "REJECTED", reason: "INVALID_EVENT" });
  });

  it("rejects an event without an idempotency key", () => {
    const { idempotency_key: _removed, ...withoutKey } = event;
    expect(wakeEvent(withoutKey, workers, policy)).toEqual({ status: "REJECTED", reason: "INVALID_EVENT" });
  });

  it("rejects a malformed envelope before queueing", () => {
    expect(wakeEvent({ event_id: "event-1" }, workers, policy)).toEqual({ status: "REJECTED", reason: "INVALID_EVENT" });
  });

  it("queues instead of crashing when no worker is capable", () => {
    const queuedEvent = { ...event, required_capability: "browser.upload", actor_capabilities: ["browser.upload"] };
    expect(wakeEvent(queuedEvent, workers, { ...policy, allowed_worker_ids: ["worker-1"] })).toEqual({ status: "QUEUED", event: queuedEvent, reason: "NO_CAPABLE_WORKER" });
  });

  it("queues when policy or tenant does not authorize a worker", () => {
    expect(wakeEvent(event, [{ ...workers[0], organization_id: "org-2" }], policy)).toEqual({ status: "QUEUED", event, reason: "NO_CAPABLE_WORKER" });
    expect(wakeEvent(event, workers, { ...policy, allowed_worker_ids: [] })).toEqual({ status: "QUEUED", event, reason: "NO_POLICY_MATCH" });
  });
});
