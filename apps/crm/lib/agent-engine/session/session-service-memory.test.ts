import { describe, expect, it } from "vitest";
import {
  InMemorySessionService,
  SessionServiceRuntimeError,
  type SessionCreateInput,
} from "./session-service";

const createInput: SessionCreateInput = {
  session_id: "session-1",
  organization_id: "org-1",
  agent_id: "agent-1",
  agent_version: "v1",
  execution_epoch: 1,
  goal: "complete task",
  constraints: [],
  facts: [],
  decisions: [],
  promises: [],
  completed: [],
  pending: ["task"],
  artifacts: [],
  errors: [],
  blockers: [],
  verification: [],
  context_budget: { max_tokens: 1000, max_items: 8, max_latency_ms: 1000 },
  idempotency_key: "create-1",
};

describe("InMemorySessionService", () => {
  it("creates, loads and checkpoints a session", async () => {
    const service = new InMemorySessionService();
    const created = await service.create(createInput);
    expect(created.state.state_version).toBe(1);
    expect((await service.load({ organization_id: "org-1", session_id: "session-1" })).state).toMatchObject({
      session_id: "session-1",
      status: "CREATED",
      state_version: 1,
    });

    const checkpoint = await service.checkpoint({
      organization_id: "org-1",
      session_id: "session-1",
      execution_epoch: 1,
      expected_state_version: 1,
      idempotency_key: "checkpoint-1",
    });
    expect(checkpoint.state.state_version).toBe(2);
    expect(checkpoint.state.status).toBe("CHECKPOINTED");
  });

  it("rejects a checkpoint with a stale expected_state_version", async () => {
    const service = new InMemorySessionService();
    await service.create(createInput);

    await expect(
      service.checkpoint({
        organization_id: "org-1",
        session_id: "session-1",
        execution_epoch: 1,
        expected_state_version: 0,
        idempotency_key: "checkpoint-stale",
      }),
    ).rejects.toMatchObject({ code: "STALE_VERSION" });
    await expect(
      service.load({ organization_id: "org-1", session_id: "session-1" }),
    ).resolves.toMatchObject({ state: { state_version: 1 } });
  });

  it("fails closed for an unknown session or wrong tenant", async () => {
    const service = new InMemorySessionService();
    await expect(service.load({ organization_id: "org-1", session_id: "missing" })).rejects.toThrow(
      "session_not_found",
    );
    await service.create(createInput);
    await expect(service.checkpoint({
      organization_id: "org-2",
      session_id: "session-1",
      execution_epoch: 1,
      expected_state_version: 1,
      idempotency_key: "wrong-tenant",
    })).rejects.toBeInstanceOf(SessionServiceRuntimeError);
  });
});
