import { describe, expect, it } from "vitest";
import { renderCustomerQuickMemory } from "./render";
import type { CustomerQuickMemory } from "./types";

const fact = (value: string, actionable = true) => ({
  value,
  source: "customer_confirmed" as const,
  confidence: 0.95,
  confirmed: true,
  conflicted: false,
  actionable,
  validFrom: "2026-08-24T12:00:00.000Z",
  validUntil: null,
  sourceRef: null,
});

function memory(): CustomerQuickMemory {
  return {
    organizationId: "00000000-0000-4000-8000-000000000001",
    contactId: "00000000-0000-4000-8000-000000000002",
    identity: { displayName: "João", primaryPhone: "+351900000000" },
    addresses: [fact("Rua Nova 10, Ovar")],
    preferences: [fact("Prefere contacto por WhatsApp"), fact("NÃO USAR", false)],
    habitualOrders: [fact("3 caixas")],
    recentOrderRefs: ["order-123"],
    relationshipSummary: "Cliente recorrente; prefere respostas objetivas.",
    channelFacts: [],
    importantEvents: [],
    updatedAt: "2026-08-24T12:00:00.000Z",
  };
}

describe("renderCustomerQuickMemory", () => {
  it("renders only safe/actionable quick facts and never tenant/contact ids", () => {
    const rendered = renderCustomerQuickMemory(memory(), { maxChars: 1200 });
    expect(rendered).toContain("João");
    expect(rendered).toContain("3 caixas");
    expect(rendered).toContain("order-123");
    expect(rendered).not.toContain("NÃO USAR");
    expect(rendered).not.toContain("00000000-0000-4000-8000-000000000001");
    expect(rendered).not.toContain("00000000-0000-4000-8000-000000000002");
  });

  it("is hard bounded even when stored strings are large", () => {
    const value = memory();
    value.relationshipSummary = "x".repeat(2000);
    value.preferences = Array.from({ length: 20 }, (_, i) => fact(`preferencia-${i}-${"y".repeat(200)}`));
    const rendered = renderCustomerQuickMemory(value, { maxChars: 500 });
    expect(rendered.length).toBeLessThanOrEqual(500);
  });
});
