import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("voice SIP worker outbound idempotency contract", () => {
  const worker = readFileSync("workers/voice-sip-worker/main.mjs", "utf8");

  it("uses voice_call_id as the in-flight retry key and never returns a conflict for the same reservation", () => {
    expect(worker).toContain("const existingPending = pendingOutbound.get(voiceCallId)");
    expect(worker).toContain("duplicate: true");
    expect(worker).toContain("provider_call_id: existingPending.providerCallId ?? null");
    expect(worker).not.toContain('outbound_call_already_pending');
  });

  it("stores provider correlation before the 202 and releases the reservation on lifecycle events", () => {
    expect(worker).toContain("pending.providerCallId = result.providerCallId");
    expect(worker).toContain("pendingOutbound.delete(voiceCallId)");
    expect(worker).toContain("pendingOutbound.delete(correlatedVoiceCallId)");
  });
});
