import { describe, expect, it, vi } from "vitest";
import { signWebhook } from "@/lib/nuvemshop/oauth";
import { NuvemshopAdapter } from "@/lib/ecommerce/nuvemshop-adapter";
import { NuvemshopApiClient } from "@/lib/nuvemshop/api-client";
import { NuvemshopCircuitBreaker } from "@/lib/ecommerce/nuvemshop-circuit";
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

  it("repete falhas transitórias sem repetir erros permanentes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("upstream", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 2 }]), { status: 200 }));
    const sleeps: number[] = [];
    const client = new NuvemshopApiClient({ storeId: "42", accessToken: "token", retryDelaysMs: [0], sleep: async (ms) => { sleeps.push(ms); } });
    await expect(client.listWebhooks()).resolves.toEqual([{ id: 2 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([0]);
    fetchMock.mockRestore();
  });

  it("mantém idempotência determinística em reentrega do webhook", () => {
    const provider = makeProvider();
    const raw = JSON.stringify({ store_id: 42, id: 7 });
    const first = provider.parseOrderEvent({ eventType: "order/created", rawBody: raw });
    const redelivery = provider.parseOrderEvent({ eventType: "order/created", rawBody: raw });
    expect(redelivery.idempotencyKey).toBe(first.idempotencyKey);
    expect(redelivery.idempotencyKey).toBe("nuvemshop:order/created:42:7");
  });


  it("abre o circuito após falhas, bloqueia chamadas e permite rollback", async () => {
    let now = 0;
    const circuit = new NuvemshopCircuitBreaker({ failureThreshold: 2, cooldownMs: 100, now: () => now });
    const failure = async () => { throw new Error("upstream"); };
    await expect(circuit.execute(failure)).rejects.toThrow("upstream");
    await expect(circuit.execute(failure)).rejects.toThrow("upstream");
    expect(circuit.health()).toMatchObject({ state: "open", healthy: false, failureCount: 2 });
    await expect(circuit.execute(async () => "blocked")).rejects.toThrow("nuvemshop_circuit_open");
    now = 100;
    await expect(circuit.execute(async () => "recovered")).resolves.toBe("recovered");
    expect(circuit.health()).toMatchObject({ state: "closed", healthy: true, failureCount: 0 });
    await expect(circuit.execute(failure)).rejects.toThrow("upstream");
    circuit.rollback();
    expect(circuit.health()).toMatchObject({ state: "closed", healthy: true, failureCount: 0 });
  });

});
