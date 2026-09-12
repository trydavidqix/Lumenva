import { describe, expect, it } from "vitest";
import { ActionBus, type ActionEnvelope, type BrowserMeshWorker } from "./action-bus";

const action: ActionEnvelope = {
  action_id: "action-1", organization_id: "org-1", assignment_id: "assignment-1", action_type: "browser.open",
  target_ref: "https://example.test", permission_level: "P1", risk_level: "R1", idempotency_key: "action-1-key",
  timeout_ms: 1000, retry_policy: "none", payload_redacted: { url: "https://example.test" },
};
const worker: BrowserMeshWorker = { worker_id: "worker-1", agent_id: "agent-1", organization_id: "org-1", capabilities: ["browser.open"], allowlisted_action_types: ["browser.open"] };

describe("ActionBus", () => {
  it("executes one mock BrowserMesh action, persists evidence, then sleeps", async () => {
    const bus = new ActionBus();
    const result = await bus.execute(worker, action, async (received) => ({ opened: received.target_ref }));
    expect(result.status).toBe("SLEEPING");
    expect(result.receipt.status).toBe("PERSISTED");
    expect(result.evidence).toMatchObject({ action_id: "action-1", result: { opened: "https://example.test" } });
    expect(bus.getEvidence("action-1-key")).toEqual(result.evidence);
  });

  it("fails closed when the worker cannot execute the action", async () => {
    const bus = new ActionBus();
    await expect(bus.execute({ ...worker, capabilities: [] }, action, async () => ({ ok: true }))).rejects.toThrow("action_capability_denied");
  });

  it("replays persisted evidence without executing the mock twice", async () => {
    const bus = new ActionBus();
    let calls = 0;
    const adapter = async () => { calls += 1; return { ok: true }; };
    await bus.execute(worker, action, adapter);
    const replay = await bus.execute(worker, action, adapter);
    expect(calls).toBe(1);
    expect(replay.receipt.status).toBe("PERSISTED");
  });
});
