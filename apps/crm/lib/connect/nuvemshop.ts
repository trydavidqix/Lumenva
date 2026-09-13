import type { EcommerceProvider } from "../ecommerce/types";
import type { ConnectProvider } from "./contracts";

export interface ConnectCommerceRecord {
  provider: string;
  externalId: string;
  occurredAt: string | null;
  currency: string | null;
  amountMinor: number | null;
  evidence: Record<string, unknown>;
}

export function createNuvemshopConnectAdapter(ecommerce: EcommerceProvider) {
  const descriptor: ConnectProvider = {
    id: "nuvemshop",
    families: ["commerce"],
    capabilities: ["connect", "disconnect", "healthCheck", "initialSync", "incrementalSync", "registerWebhooks", "handleWebhook", "getProducts", "getOrders", "getSales", "getRefunds"],
  };

  return {
    descriptor,
    async getOrders(input: { since: string }): Promise<ConnectCommerceRecord[]> {
      const orders = await ecommerce.listOrdersSince(input.since);
      return orders.map((order) => ({
        provider: "nuvemshop",
        externalId: order.externalId,
        occurredAt: order.createdAt,
        currency: order.currency,
        amountMinor: order.totalCents,
        evidence: { providerRef: order.externalId },
      }));
    },
    async getSales(input: { since: string }): Promise<ConnectCommerceRecord[]> {
      return this.getOrders(input);
    },
    async getRefunds(): Promise<ConnectCommerceRecord[]> {
      // Existing Nuvemshop seam does not expose a dedicated refunds reader yet.
      // Capability remains declared for webhook-normalized refund support; pull sync
      // intentionally returns no fabricated facts until that reader is available.
      return [];
    },
  };
}
