import { describe, expect, it } from "vitest";
import { processWebhookOnce, type WebhookReplayStore } from "./webhook-replay";

const input = { organizationId: "00000000-0000-0000-0000-00000000000a", provider: "fake", eventId: "evt-1" };

describe("processWebhookOnce", () => {
  it("marks a successful claim complete", async () => {
    const completed: string[] = [];
    const store: WebhookReplayStore = {
      claim: async () => ({ state: "claimed", token: "token-1" }),
      complete: async (_input, token) => { completed.push(token); },
      fail: async () => { throw new Error("unexpected_fail"); },
    };
    await expect(processWebhookOnce(store, input, async () => undefined)).resolves.toBe("processed");
    expect(completed).toEqual(["token-1"]);
  });

  it("records a failed attempt and allows a later retry", async () => {
    let state: "fresh" | "failed" | "processed" = "fresh";
    const store: WebhookReplayStore = {
      claim: async () => state === "processed" ? { state: "duplicate" } : { state: "claimed", token: state === "fresh" ? "token-1" : "token-2" },
      complete: async (_input, token) => { expect(token).toBe("token-2"); state = "processed"; },
      fail: async (_input, token) => { expect(token).toBe("token-1"); state = "failed"; },
    };
    await expect(processWebhookOnce(store, input, async () => { throw new Error("handler_failed"); })).rejects.toThrow("handler_failed");
    await expect(processWebhookOnce(store, input, async () => undefined)).resolves.toBe("processed");
    expect(state).toBe("processed");
  });

  it("distinguishes an active concurrent claim from an already processed duplicate", async () => {
    let calls = 0;
    const inProgress: WebhookReplayStore = {
      claim: async () => ({ state: "in_progress" }),
      complete: async () => undefined,
      fail: async () => undefined,
    };
    await expect(processWebhookOnce(inProgress, input, async () => { calls += 1; })).resolves.toBe("in_progress");
    expect(calls).toBe(0);

    const duplicate: WebhookReplayStore = {
      claim: async () => ({ state: "duplicate" }),
      complete: async () => undefined,
      fail: async () => undefined,
    };
    await expect(processWebhookOnce(duplicate, input, async () => { calls += 1; })).resolves.toBe("duplicate");
    expect(calls).toBe(0);
  });
});
