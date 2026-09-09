import { describe, expect, it, vi } from "vitest";
import { signWebhook } from "@/lib/nuvemshop/oauth";
import { NuvemshopAdapter } from "@/lib/ecommerce/nuvemshop-adapter";
import type { EcommerceProvider } from "@/lib/ecommerce/types";

const SECRET = "contract-secret";

function makeProvider(): EcommerceProvider {
  const client = { get: vi.fn(async () => []) };
  return new NuvemshopAdapter({ storeId: "42", accessToken: "token", clientSecret: SECRET, client: client as never });
}

describe("EcommerceProvider contract — NuvemshopAdapter", () => {
  it("verifica assinatura sobre o corpo bruto e rejeita alterações", () => {
    const provider = makeProvider();
    const raw = '{"id":7}';
    const signature = signWebhook(raw, SECRET);
    expect(provider.verifyWebhookSignature(raw, signature)).toBe(true);
    expect(provider.verifyWebhookSignature(`${raw} `, signature)).toBe(false);
    expect(provider.verifyWebhookSignature(raw, "not-hex")).toBe(false);
  });

  it("normaliza evento de pedido e fornece chave idempotente estável", () => {
    const provider = makeProvider();
    const parsed = provider.parseOrderEvent({ store_id: 42, id: 7, total: "10.00" }, "order/created");
    expect(parsed).toMatchObject({ event: "order/created", externalId: "7", storeId: "42" });
    expect(parsed.idempotencyKey).toBe("nuvemshop:order/created:42:7");
    expect(provider.parseOrderEvent({ store_id: 42, id: 7 }, "order/created").idempotencyKey).toBe(parsed.idempotencyKey);
  });

  it("cobre data_request e redact, inclusive fallback sem event_id", () => {
    const provider = makeProvider();
    const request = provider.parseCustomerDataRequest({ store_id: 42, customer: { id: 9 } });
    expect(request.customerId).toBe("9");
    expect(request.idempotencyKey).toContain("customer/data_request:");
    expect(provider.parseRedactRequest({ store_id: 42, customer: { id: 9 }, event_id: "evt" })).toMatchObject({ scope: "customer", eventId: "evt", idempotencyKey: "nuvemshop:customer/redact:evt" });
    expect(provider.parseRedactRequest({ store_id: 42 }, "store").scope).toBe("store");
  });

  it("normaliza moeda ISO e mantém listagem de pedidos provider-neutral", async () => {
    const client = { get: vi.fn(async () => [{ id: 1, currency: "eur", total: "12.34", created_at: "2026-01-01T00:00:00Z" }]) };
    const provider = new NuvemshopAdapter({ storeId: "42", accessToken: "token", clientSecret: SECRET, client: client as never });
    expect(provider.normalizeCurrency("€")).toBe("EUR");
    expect(provider.normalizeCurrency("brl")).toBe("BRL");
    await expect(provider.listOrdersSince("2026-01-01T00:00:00Z")).resolves.toEqual([{ externalId: "1", currency: "EUR", totalCents: 1234, createdAt: "2026-01-01T00:00:00Z", raw: expect.any(Object) }]);
    expect(client.get).toHaveBeenCalledWith(expect.stringContaining("created_at_min="));
  });
});
