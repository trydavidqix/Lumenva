import { describe, expect, it } from "vitest";

import {
  VOICE_CALL_STATES,
  VOICE_PARTICIPANT_ROLES,
  VOICE_PROVIDERS,
  isVoiceCallState,
  isVoiceProvider,
  validateVoiceCallContext,
  type VoiceCallContext,
} from "./contracts";

describe("voice core contracts", () => {
  it("accepts only canonical voice call states", () => {
    expect(VOICE_CALL_STATES).toEqual([
      "queued",
      "ringing",
      "connecting",
      "active",
      "held",
      "transferring",
      "completed",
      "failed",
      "canceled",
    ]);
    for (const state of VOICE_CALL_STATES) expect(isVoiceCallState(state)).toBe(true);
    expect(isVoiceCallState("unknown")).toBe(false);
  });

  it("defines only customer, AI and human participants", () => {
    expect(VOICE_PARTICIPANT_ROLES).toEqual(["customer", "ai_agent", "human_agent"]);
  });

  it("keeps telephony providers a closed vocabulary", () => {
    expect(VOICE_PROVIDERS).toEqual(["telnyx"]);
    expect(isVoiceProvider("telnyx")).toBe(true);
    expect(isVoiceProvider("anything-else")).toBe(false);
  });

  it("requires organization identity but permits an unresolved contact at call start", () => {
    const context: VoiceCallContext = {
      voiceCallId: "call-1",
      organizationId: "org-1",
      contactId: null,
      agentId: null,
      conversationId: null,
      state: "ringing",
      direction: "inbound",
      callerNumber: "+351211234567",
      calledNumber: "+351219999999",
    };
    expect(validateVoiceCallContext(context)).toEqual({ ok: true, value: context });
  });

  it("rejects a persistable context without organizationId", () => {
    expect(
      validateVoiceCallContext({
        voiceCallId: "call-1",
        organizationId: "",
        contactId: null,
        agentId: null,
        conversationId: null,
        state: "ringing",
        direction: "inbound",
        callerNumber: "+351211234567",
        calledNumber: "+351219999999",
      }),
    ).toEqual({ ok: false, reason: "organization_required" });
  });
});
