import type { NuvemshopApiClient } from "../../../nuvemshop/api-client";
import { NuvemshopApiError } from "../../../nuvemshop/api-client";
import type { EcommerceOrder } from "../../types";

export interface DropshippingStoreSnapshot<T> {
  data: T[];
  isPartial: boolean;
  stale: boolean;
  fetchedAt: string;
  source: string;
}

export interface DropshippingStoreError {
  status: "EXTERNAL_VALIDATION_PENDING" | "BLOCKED" | "RATE_LIMITED" | "ERROR";
  reason: string;
}

export interface DropshippingProduct {
  externalId: string;
  name: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  variants: DropshippingVariant[];
  raw: Record<string, unknown>;
}

export interface DropshippingVariant {
  externalId: string;
  price: string;
  stock: number | null;
  sku: string | null;
}

export type DropshippingResult<T> =
  | { ok: true; snapshot: DropshippingStoreSnapshot<T> }
  | { ok: false; error: DropshippingStoreError };

export class DropshippingStoreAdapter {
  private readonly client: NuvemshopApiClient;
  private readonly expectedStoreId: string;

  constructor(client: NuvemshopApiClient, expectedStoreId: string) {
    this.client = client;
    this.expectedStoreId = expectedStoreId;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleError(error: unknown): DropshippingResult<any> {
    if (error instanceof NuvemshopApiError) {
      if (error.status === 401 || error.status === 403) {
        return { ok: false, error: { status: "EXTERNAL_VALIDATION_PENDING", reason: "Unauthorized or insufficient permissions" } };
      }
      if (error.status === 429) {
        return { ok: false, error: { status: "RATE_LIMITED", reason: "Rate limit exceeded" } };
      }
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return { ok: false, error: { status: "ERROR", reason: message } };
  }

  async getProducts(page = 1, perPage = 50): Promise<DropshippingResult<DropshippingProduct>> {
    try {
      const store = await this.client.getStore();
      if (String(store.id) !== this.expectedStoreId) {
         return { ok: false, error: { status: "BLOCKED", reason: "Store ID mismatch" } };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const products = await this.client.get<any[]>(`/products?page=${page}&per_page=${perPage}`);

      const mapped: DropshippingProduct[] = products.map((p) => ({
        externalId: String(p.id),
        name: typeof p.name === "string" ? p.name : (p.name?.pt || p.name?.en || "Unknown"),
        published: Boolean(p.published),
        createdAt: String(p.created_at),
        updatedAt: String(p.updated_at),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        variants: (p.variants || []).map((v: any) => ({
          externalId: String(v.id),
          price: String(v.price),
          stock: v.stock,
          sku: v.sku || null,
        })),
        raw: p,
      }));

      return {
        ok: true,
        snapshot: {
          data: mapped,
          isPartial: mapped.length < perPage,
          stale: false,
          fetchedAt: new Date().toISOString(),
          source: "nuvemshop",
        }
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getOrders(page = 1, perPage = 50): Promise<DropshippingResult<EcommerceOrder>> {
    try {
      const store = await this.client.getStore();
      if (String(store.id) !== this.expectedStoreId) {
         return { ok: false, error: { status: "BLOCKED", reason: "Store ID mismatch" } };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orders = await this.client.get<any[]>(`/orders?page=${page}&per_page=${perPage}`);

      const mapped: EcommerceOrder[] = orders.map((o) => ({
        externalId: String(o.id),
        currency: String(o.currency || o.currency_code || "Unknown"),
        totalCents: o.total ? Math.round(Number(o.total) * 100) : null,
        createdAt: String(o.created_at),
        raw: o,
      }));

      return {
        ok: true,
        snapshot: {
          data: mapped,
          isPartial: mapped.length < perPage,
          stale: false,
          fetchedAt: new Date().toISOString(),
          source: "nuvemshop",
        }
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}
