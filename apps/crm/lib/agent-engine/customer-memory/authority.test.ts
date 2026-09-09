import { describe, expect, it } from "vitest";

import {
  authorityForField,
  canUseMemoryFactOperationally,
  chooseMemoryFact,
} from "./authority";
import type { CustomerMemoryFact } from "./types";

const fact = (overrides: Partial<CustomerMemoryFact> = {}): CustomerMemoryFact => ({
  value: "Rua Nova 10",
  source: "conversation_derived",
  confidence: 0.9,
  confirmed: false,
  conflicted: false,
  actionable: false,
  validFrom: "2026-08-24T00:00:00.000Z",
  validUntil: null,
  sourceRef: null,
  ...overrides,
});

describe("Customer Memory authority", () => {
  it("separa campos autoritativos de campos mutáveis/derivados", () => {
    expect(authorityForField("recent_order_ref")).toBe("authoritative");
    expect(authorityForField("payment_state")).toBe("authoritative");
    expect(authorityForField("consent_state")).toBe("authoritative");
    expect(authorityForField("address")).toBe("mutable");
    expect(authorityForField("phone")).toBe("mutable");
    expect(authorityForField("preference")).toBe("derived");
    expect(authorityForField("relationship_summary")).toBe("derived");
  });

  it("nunca torna um fato conflitante acionável", () => {
    expect(
      canUseMemoryFactOperationally("address", fact({ conflicted: true, confirmed: true })),
    ).toBe(false);
  });

  it("não deixa conversa derivada sobrescrever estado de pedido/pagamento/consentimento", () => {
    expect(
      canUseMemoryFactOperationally(
        "payment_state",
        fact({ source: "conversation_derived", confidence: 1, confirmed: true }),
      ),
    ).toBe(false);
    expect(
      canUseMemoryFactOperationally(
        "recent_order_ref",
        fact({ source: "order", confidence: 1, confirmed: true, actionable: true }),
      ),
    ).toBe(true);
  });

  it("exige confirmação para telefone/endereço inferidos da conversa", () => {
    expect(canUseMemoryFactOperationally("address", fact({ confidence: 0.99 }))).toBe(false);
    expect(
      canUseMemoryFactOperationally("address", fact({ confidence: 0.99, confirmed: true })),
    ).toBe(true);
  });

  it("permite preferência derivada só com confiança alta e sem conflito", () => {
    expect(canUseMemoryFactOperationally("preference", fact({ confidence: 0.7 }))).toBe(false);
    expect(canUseMemoryFactOperationally("preference", fact({ confidence: 0.9 }))).toBe(true);
  });

  it("prefere fonte autoritativa e confirmação do cliente à inferência", () => {
    const inferred = fact({ value: "morada antiga", confidence: 0.99 });
    const confirmed = fact({
      value: "morada confirmada",
      source: "customer_confirmed",
      confidence: 0.9,
      confirmed: true,
    });
    const crm = fact({
      value: "morada CRM",
      source: "crm",
      confidence: 1,
      confirmed: true,
      actionable: true,
    });

    expect(chooseMemoryFact("address", [inferred, confirmed])?.value).toBe("morada confirmada");
    expect(chooseMemoryFact("address", [confirmed, crm])?.value).toBe("morada CRM");
  });
});
