import { describe, expect, it } from "vitest";
import { normalizePatterMetrics, redactVoiceLogFields } from "./telemetry";

describe("Patter telemetry normalization", () => {
  it("maps provider metrics into the Lumenva voice schema", () => {
    expect(
      normalizePatterMetrics({
        carrierMs: 31,
        sttMs: 120,
        agentMs: 420,
        ttsMs: 95,
        e2eMs: 710,
        interruptionMs: 54,
        carrierCostCents: 1.2,
        sttCostCents: 0.3,
        ttsCostCents: 0.4,
      }),
    ).toEqual({
      carrier_ms: 31,
      stt_ms: 120,
      agent_ms: 420,
      tts_ms: 95,
      e2e_ms: 710,
      interruption_ms: 54,
      carrier_cost_cents: 1.2,
      stt_cost_cents: 0.3,
      tts_cost_cents: 0.4,
      total_voice_cost_cents: 1.9,
    });
  });

  it("never carries transcript, prompt or raw provider payload", () => {
    const normalized = normalizePatterMetrics({
      sttMs: 100,
      transcript: "secret",
      rawPayload: { phone: "+351912345678" },
      prompt: "hidden",
    } as never) as unknown as Record<string, unknown>;
    expect(normalized).not.toHaveProperty("transcript");
    expect(normalized).not.toHaveProperty("prompt");
    expect(normalized).not.toHaveProperty("rawPayload");
  });

  it("redacts E.164 numbers in structured log fields", () => {
    expect(
      redactVoiceLogFields({
        voice_call_id: "call-1",
        from: "+351912345678",
        to: "+351211234567",
        status: "active",
      }),
    ).toEqual({
      voice_call_id: "call-1",
      from: "***5678",
      to: "***4567",
      status: "active",
    });
  });
});
