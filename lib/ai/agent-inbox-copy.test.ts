import { describe, expect, it } from "vitest";
import { kindLabel, KIND_LABEL, SEVERITY_LABEL } from "./agent-inbox-copy";

describe("agent-inbox-copy — rótulos leigos dos avisos do runtime", () => {
  it("traduz kinds conhecidos do schema (agent_inbox_items.kind)", () => {
    expect(kindLabel("qr_rescan")).toContain("QR");
    expect(kindLabel("budget_exceeded")).toContain("orçamento");
    expect(kindLabel("handoff")).toContain("humano");
  });

  it("kind desconhecido cai no rótulo genérico sem quebrar", () => {
    expect(kindLabel("kind_novo_do_engine")).toBe("Aviso do assistente");
  });

  it("cobre todos os kinds do check constraint da migration 0050", () => {
    const constraintKinds = [
      "qr_rescan",
      "job_dead",
      "event_dead",
      "budget_exceeded",
      "handoff",
      "promotion_review",
      "judge_unaligned",
      "other",
    ];
    for (const k of constraintKinds) {
      expect(KIND_LABEL[k], `sem rótulo para kind '${k}'`).toBeTruthy();
    }
  });

  it("severidades têm rótulo leigo", () => {
    expect(SEVERITY_LABEL.info).toBe("informativo");
    expect(SEVERITY_LABEL.warn).toBe("atenção");
    expect(SEVERITY_LABEL.critical).toBe("crítico");
  });
});
