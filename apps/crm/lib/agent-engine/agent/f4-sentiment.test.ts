import { describe, expect, it } from "vitest";

import { classifySentiment } from "./sentiment";

describe("F4-SENTIMENT-001 workflow", () => {
  it("classifica sinais sem provider e mantém output determinístico", () => {
    const cases = [
      ["O produto é péssimo e quero cancelar", "negative", 0.1],
      ["Qual é o preço e prazo?", "neutral", 0.5],
      ["Obrigado, funcionou perfeitamente", "positive", 0.9],
    ] as const;

    for (const [input, label, score] of cases) {
      expect(classifySentiment(input)).toMatchObject({ label, score });
      expect(classifySentiment(input)).toEqual(classifySentiment(input));
    }
  });

  it("degrada texto vazio e desconhecido para neutro", () => {
    expect(classifySentiment("")).toEqual({ label: "neutral", score: 0.5, signals: [] });
    expect(classifySentiment("mensagem sem carga emocional")).toEqual({ label: "neutral", score: 0.5, signals: [] });
  });
});
