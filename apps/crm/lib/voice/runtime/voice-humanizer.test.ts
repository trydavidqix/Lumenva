import { describe, expect, it } from "vitest";

import { prepareSpeakableVoiceText } from "./voice-humanizer";

describe("prepareSpeakableVoiceText", () => {
  it("removes canned bot praise without changing the actual answer", () => {
    expect(prepareSpeakableVoiceText("Ótima pergunta! O horário é 15:30."))
      .toBe("O horário é 15:30.");
  });

  it("removes visual markdown that should not be spoken", () => {
    expect(prepareSpeakableVoiceText("**Claro.** Use o código `ABC-123`."))
      .toBe("Claro. Use o código ABC-123.");
  });

  it("preserves numbers, dates, prices and all factual sentences", () => {
    const text = "A consulta custa 45,90 €. Está marcada para 21/09/2026 às 10:15. Leve o documento 12345.";
    expect(prepareSpeakableVoiceText(text)).toBe(text);
  });

  it("does not truncate long but factual replies", () => {
    const text = "Primeiro confirme o nome. Depois confirme a data. Por fim, valide o endereço.";
    expect(prepareSpeakableVoiceText(text)).toBe(text);
  });
});
