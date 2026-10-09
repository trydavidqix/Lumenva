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

  private handleError<T>(error: unknown): DropshippingResult<T> {
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

      const products = await this.client.get<unknown[]>(`/products?page=${page}&per_page=${perPage}`);
      if (!Array.isArray(products)) {
        throw new Error("Invalid response: expected array of products");
      }

      const mapped: DropshippingProduct[] = [];
      for (const p of products) {
        if (!p || typeof p !== "object") continue;
        const record = p as Record<string, unknown>;

        let name = "Unknown";
        if (typeof record.name === "string") {
          name = record.name;
        } else if (record.name && typeof record.name === "object") {
          const nameObj = record.name as Record<string, string>;
          name = nameObj.pt || nameObj.en || "Unknown";
        }

        const rawVariants = Array.isArray(record.variants) ? record.variants : [];
        const variants: DropshippingVariant[] = [];

        for (const v of rawVariants) {
          if (!v || typeof v !== "object") continue;
          const vRecord = v as Record<string, unknown>;

          const priceNum = Number(vRecord.price);
          if (vRecord.price === undefined || vRecord.price === null || !Number.isFinite(priceNum)) {
             throw new Error("Malformed money payload in variant");
          }

          let stock: number | null = null;
          if (vRecord.stock !== null && vRecord.stock !== undefined) {
             stock = Number(vRecord.stock);
             if (!Number.isFinite(stock)) {
                throw new Error("Malformed stock payload in variant");
             }
          }

          variants.push({
            externalId: String(vRecord.id),
            price: String(priceNum),
            stock,
            sku: typeof vRecord.sku === "string" ? vRecord.sku : null,
          });
        }

        mapped.push({
          externalId: String(record.id),
          name,
          published: Boolean(record.published),
          createdAt: String(record.created_at),
          updatedAt: String(record.updated_at),
          variants,
        });
      }

      return {
        ok: true,
        snapshot: {
          data: mapped,
          isPartial: mapped.length === perPage,
          stale: false,
          fetchedAt: new Date().toISOString(),
          source: "nuvemshop",
        }
      };
    } catch (error) {
      return this.handleError<DropshippingProduct>(error);
    }
  }

  async getOrders(page = 1, perPage = 50): Promise<DropshippingResult<EcommerceOrder>> {
    try {
      const store = await this.client.getStore();
      if (String(store.id) !== this.expectedStoreId) {
         return { ok: false, error: { status: "BLOCKED", reason: "Store ID mismatch" } };
      }

      const orders = await this.client.get<unknown[]>(`/orders?page=${page}&per_page=${perPage}`);
      if (!Array.isArray(orders)) {
        throw new Error("Invalid response: expected array of orders");
      }

      const mapped: EcommerceOrder[] = [];
      for (const o of orders) {
        if (!o || typeof o !== "object") continue;
        const record = o as Record<string, unknown>;

        const numTotal = Number(record.total);
        if (record.total === undefined || record.total === null || !Number.isFinite(numTotal)) {
           throw new Error("Malformed money payload in order");
        }

        mapped.push({
          externalId: String(record.id),
          currency: String(record.currency || record.currency_code || "Unknown"),
          totalCents: Math.round(numTotal * 100),
          createdAt: String(record.created_at),
          raw: {}, // Redacted to prevent PII leak
        });
      }

      return {
        ok: true,
        snapshot: {
          data: mapped,
          isPartial: mapped.length === perPage,
          stale: false,
          fetchedAt: new Date().toISOString(),
          source: "nuvemshop",
        }
      };
    } catch (error) {
      return this.handleError<EcommerceOrder>(error);
    }
  }
}
