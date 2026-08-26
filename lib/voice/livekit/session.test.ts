import { describe, expect, it, vi } from "vitest";
import {
  createLiveKitParticipantIdentity,
  createLiveKitRoomName,
  createLiveKitSessionManager,
  type LiveKitServerPort,
} from "./session";

describe("LiveKit voice session boundary", () => {
  it("uses opaque call ids for room names and never tenant/contact/phone PII", () => {
    const room = createLiveKitRoomName("018f6c38-31d7-7f5e-9b82-442c66d7f111");
    expect(room).toBe("voice_018f6c38-31d7-7f5e-9b82-442c66d7f111");
    expect(room).not.toContain("+351");
    expect(room).not.toContain("contact");
    expect(room).not.toContain("organization");
  });

  it("uses opaque participant identities instead of names or phone numbers", () => {
    expect(createLiveKitParticipantIdentity("call-1", "customer", "a1")).toBe("voice:call-1:customer:a1");
    expect(createLiveKitParticipantIdentity("call-1", "ai_agent", "b2")).toBe("voice:call-1:ai_agent:b2");
  });

  it("preserves the same room across reconnects for a call", async () => {
    const port: LiveKitServerPort = {
      ensureRoom: vi.fn().mockResolvedValue(undefined),
      mintJoinToken: vi.fn().mockResolvedValue("signed-token"),
    };
    const manager = createLiveKitSessionManager(port);
    const first = await manager.prepare({ voiceCallId: "call-1", participantRole: "ai_agent", participantNonce: "n1" });
    const second = await manager.prepare({ voiceCallId: "call-1", participantRole: "ai_agent", participantNonce: "n2" });
    expect(first.roomName).toBe(second.roomName);
    expect(port.ensureRoom).toHaveBeenCalledWith(expect.objectContaining({ roomName: "voice_call-1" }));
  });

  it("requests audio-only room grants with short token ttl", async () => {
    const port: LiveKitServerPort = {
      ensureRoom: vi.fn().mockResolvedValue(undefined),
      mintJoinToken: vi.fn().mockResolvedValue("signed-token"),
    };
    await createLiveKitSessionManager(port).prepare({
      voiceCallId: "call-1",
      participantRole: "human_agent",
      participantNonce: "h1",
    });
    expect(port.mintJoinToken).toHaveBeenCalledWith(expect.objectContaining({
      roomName: "voice_call-1",
      ttlSeconds: 300,
      canPublishAudio: true,
      canSubscribeAudio: true,
      canPublishVideo: false,
    }));
  });
});
