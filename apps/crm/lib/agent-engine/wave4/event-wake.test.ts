import { describe, expect, it } from "vitest";
import { signWakeEvent, wakeEvent, wakeEventPersisted, type WakeEvent, type WakePolicy, type WakeWorker } from "./event-wake";
import { PostgresWakeEventStore } from "./event-idempotency";
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
  it("claims a valid event in Postgres before waking and rejects replay", async () => {
    const calls: string[] = [];
    const db = { query: async <T>(text: string) => { calls.push(text); return { rows: calls.length === 1 ? [{ id: "claim-1", organization_id: "org-1", event_id: "event-1", idempotency_key: event.idempotency_key, status: "CLAIMED" }] as T[] : [] }; } };
    const store = new PostgresWakeEventStore(db);
    await expect(wakeEventPersisted(event, workers, policy, SECRET, store)).resolves.toMatchObject({ status: "WAKED" });
    await expect(wakeEventPersisted(event, workers, policy, SECRET, store)).resolves.toEqual({ status: "DUPLICATE", event_id: "event-1", reason: "IDEMPOTENT_REPLAY" });
    expect(calls[0]).toMatch(/insert into public\.browsermesh_event_idempotency/i);
    expect(calls[0]).toMatch(/on conflict \(organization_id,idempotency_key\) do nothing returning/i);
  });
});
