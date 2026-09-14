import { describe, expect, it } from "vitest";

import { validateVoiceOutput } from "./voice-output-policy";

describe("voice output policy", () => {
  it("accepts one or two short sentences with an explicit turn-pass signal", () => {
    expect(validateVoiceOutput("Entendi. Quer que eu verifique isso contigo?")).toEqual({ ok: true });
    expect(validateVoiceOutput("Pode falar.")).toEqual({ ok: true });
  });

  it("rejects more than two sentences", () => {
    expect(validateVoiceOutput("Entendi. Vou verificar. Quer aguardar?")).toEqual({
      ok: false,
      reason: "voice_output_too_many_sentences",
    });
  });

  it("rejects raw digits and currency symbols", () => {
    expect(validateVoiceOutput("O valor é 50€. Quer continuar?")).toEqual({
      ok: false,
      reason: "voice_output_unspoken_value",
    });
  });

  it("rejects a response with no explicit end-of-turn signal", () => {
    expect(validateVoiceOutput("Entendi. Vou verificar isso agora.")).toEqual({
      ok: false,
      reason: "voice_output_turn_signal_missing",
    });
  });

  it("rejects empty output", () => {
    expect(validateVoiceOutput("   ")).toEqual({ ok: false, reason: "voice_output_empty" });
  });
});
