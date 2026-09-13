import { describe, expect, it } from "vitest";
import { createNuvemshopConnectAdapter } from "./nuvemshop";
import type { EcommerceProvider } from "../ecommerce/types";

const ecommerce = {
  provider: "nuvemshop",
  name: "Nuvemshop",
  listOrdersSince: async () => [{ externalId: "o-1", currency: "EUR", totalCents: 1099, createdAt: "2026-09-13T00:00:00Z", raw: {} }],
} as unknown as EcommerceProvider;

describe("Nuvemshop through Connect", () => {
  it("declares only the capabilities proven by the existing adapter", async () => {
    const adapter = createNuvemshopConnectAdapter(ecommerce);
    expect(adapter.descriptor.capabilities).toEqual(expect.arrayContaining(["healthCheck", "getOrders", "getSales", "getRefunds"]));
    expect(adapter.descriptor.capabilities).not.toContain("getPayouts");
    expect(await adapter.getOrders({ since: "2026-09-12T00:00:00Z" })).toEqual([
      expect.objectContaining({ provider: "nuvemshop", externalId: "o-1", occurredAt: "2026-09-13T00:00:00Z" }),
    ]);
  });
});
