import { describe, expect, it } from "vitest";
import {
  InMemorySessionPersistence,
  SessionService,
} from "./service";
import {
  createGeminiAdapter,
  createGroqAdapter,
  MockModelProvider,
  ModelProviderError,
} from "./providers";

describe("Wave 3 session runtime MVP", () => {
  it("uses the sandbox mock provider without credentials or network", async () => {
    const provider = new MockModelProvider("deterministic");
    await expect(
      provider.complete({ sessionId: "s-1", prompt: "hello" }),
    ).resolves.toMatchObject({
      provider: "mock",
      model: "mock-model",
      text: "deterministic",
    });
  });

  it("keeps Gemini and Groq adapters contract-only and fail closed", async () => {
    for (const provider of [createGeminiAdapter(), createGroqAdapter()]) {
      await expect(
        provider.complete({ sessionId: "s-1", prompt: "hello" }),
      ).rejects.toEqual(
        new ModelProviderError("provider_disabled", `model_provider_disabled:${provider.id}`),
      );
    }
  });

  it("persists reducer events and snapshots, then replays deterministically", async () => {
    const persistence = new InMemorySessionPersistence();
    const service = new SessionService(persistence, persistence);
    await service.start("session-1");

    const applied = await service.apply("session-1", {
      status: "waiting",
      message: "fact",
      handoff_safe: true,
      state_updates: { known_facts: { customer: "Ana" } },
      completed_actions: [],
      evidence_refs: [],
    });

    expect(applied.snapshot.state.knownFacts).toEqual({ customer: "Ana" });
    expect(applied.snapshot.eventCount).toBe(1);
    expect((await service.replay("session-1")).knownFacts).toEqual({ customer: "Ana" });
  });

  it("does not duplicate an event when the same event is appended twice", async () => {
    const persistence = new InMemorySessionPersistence();
    const service = new SessionService(persistence, persistence);
    const result = await service.apply("session-2", {
      status: "waiting",
      message: "fact",
      handoff_safe: true,
      state_updates: { known_facts: { x: "y" } },
      completed_actions: [],
      evidence_refs: [],
    });

    const event = result.events[0]!;
    await expect(persistence.append(event)).resolves.toEqual({ deduped: true });
    expect(await persistence.list("session-2")).toHaveLength(1);
  });
});
