import { describe, expect, it } from "vitest";
import { signWakeEvent, wakeEvent, type WakeEvent, type WakePolicy, type WakeWorker } from "./event-wake";
const SECRET = "fixture-shared-secret";
const unsigned: Omit<WakeEvent, "signature"> = { event_id: "event-1", organization_id: "org-1", actor_id: "actor-1", actor_capabilities: ["browser.open"], required_capability: "browser.open", idempotency_key: "event-1-replay", payload: { url: "https://example.test" } };
const event = signWakeEvent(unsigned, SECRET);
const policy: WakePolicy = { organization_id: "org-1", allowed_worker_ids: ["worker-1"] };
const workers: WakeWorker[] = [{ worker_id: "worker-1", agent_id: "agent-1", organization_id: "org-1", capabilities: ["browser.open"], available: true }];
describe("EventWake", () => {
  it("signs at origin and wakes only after valid HMAC verification", () => { expect(wakeEvent(event, workers, policy, SECRET)).toEqual({ status: "WAKED", event_id: "event-1", worker_id: "worker-1", agent_id: "agent-1" }); });
  it("rejects an event without a signature", () => { expect(wakeEvent(unsigned, workers, policy, SECRET)).toEqual({ status: "REJECTED", reason: "INVALID_SIGNATURE" }); });
  it("rejects a tampered or wrongly signed event", () => { expect(wakeEvent({ ...event, payload: { url: "https://tampered.test" } }, workers, policy, SECRET)).toEqual({ status: "REJECTED", reason: "INVALID_SIGNATURE" }); expect(wakeEvent(event, workers, policy, "wrong-secret")).toEqual({ status: "REJECTED", reason: "INVALID_SIGNATURE" }); });
  it("rejects malformed envelope before queueing", () => { expect(wakeEvent({ event_id: "event-1" }, workers, policy, SECRET)).toEqual({ status: "REJECTED", reason: "INVALID_EVENT" }); });
  it("queues a validly signed event instead of crashing when no worker is capable", () => { const queued = signWakeEvent({ ...unsigned, required_capability: "browser.upload", actor_capabilities: ["browser.upload"] }, SECRET); expect(wakeEvent(queued, workers, policy, SECRET)).toEqual({ status: "QUEUED", event: queued, reason: "NO_CAPABLE_WORKER" }); });
  it("queues when policy or tenant does not authorize a worker", () => { expect(wakeEvent(event, [{ ...workers[0], organization_id: "org-2" }], policy, SECRET)).toEqual({ status: "QUEUED", event, reason: "NO_CAPABLE_WORKER" }); expect(wakeEvent(event, workers, { ...policy, allowed_worker_ids: [] }, SECRET)).toEqual({ status: "QUEUED", event, reason: "NO_POLICY_MATCH" }); });
});
