import { describe, expect, it, vi } from "vitest";
import { createBrowserHumanVoiceAdapter } from "./adapter";

describe("optional browser human voice adapter", () => {
  it("stays disabled without importing or requiring LiveKit credentials", async () => {
    const adapter = createBrowserHumanVoiceAdapter({ enabled: false });
    await expect(adapter.prepareTakeover({ organizationId: "org-1", voiceCallId: "call-1" })).resolves.toEqual({
      kind: "disabled",
    });
  });

  it("delegates only when browser takeover is explicitly enabled", async () => {
    const prepare = vi.fn(async () => ({ roomName: "voice-call-opaque", token: "token" }));
    const adapter = createBrowserHumanVoiceAdapter({ enabled: true, prepare });

    await expect(adapter.prepareTakeover({ organizationId: "org-1", voiceCallId: "call-1" })).resolves.toEqual({
      kind: "ready",
      roomName: "voice-call-opaque",
      token: "token",
    });
    expect(prepare).toHaveBeenCalledOnce();
  });

  it("fails closed when enabled without a configured transport", async () => {
    const adapter = createBrowserHumanVoiceAdapter({ enabled: true });
    await expect(adapter.prepareTakeover({ organizationId: "org-1", voiceCallId: "call-1" })).rejects.toThrow(
      /transport/i,
    );
  });
});
