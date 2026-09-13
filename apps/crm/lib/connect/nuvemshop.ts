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
  // Fail closed: advertise only the verbs the existing provider-neutral adapter
  // can execute today. OAuth/webhook/product support elsewhere in the Nuvemshop
  // integration does not become a Connect capability until it has this contract.
  const descriptor: ConnectProvider = {
    id: "nuvemshop",
    families: ["commerce"],
    capabilities: ["getOrders", "getSales"],
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
  };
}
