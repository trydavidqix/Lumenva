import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mocked } from "vitest";
import { DropshippingStoreAdapter } from "../../../../lib/ecommerce/dropshipping/store/adapter";
import type { NuvemshopApiClient } from "../../../../lib/nuvemshop/api-client";
import { NuvemshopApiError } from "../../../../lib/nuvemshop/api-client";

describe("DropshippingStoreAdapter", () => {
  const expectedStoreId = "12345";
  let mockClient: Mocked<NuvemshopApiClient>;
  let adapter: DropshippingStoreAdapter;

  beforeEach(() => {
    mockClient = {
      getStore: vi.fn(),
      get: vi.fn(),
    } as unknown as Mocked<NuvemshopApiClient>;
    adapter = new DropshippingStoreAdapter(mockClient, expectedStoreId);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:00:00Z"));
  });

  it("should fetch products successfully with isPartial=false for less than perPage", async () => {
    mockClient.getStore.mockResolvedValue({ id: 12345, name: "Test Store" });
    mockClient.get.mockResolvedValue([
      {
        id: 1,
        name: { pt: "Produto 1" },
        published: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        variants: [{ id: 10, price: "10.00", stock: 5, sku: "SKU1" }],
      }
    ]);

    const result = await adapter.getProducts(1, 50);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.data).toHaveLength(1);
      expect(result.snapshot.data[0]?.externalId).toBe("1");
      expect(result.snapshot.data[0]?.name).toBe("Produto 1");
      expect(result.snapshot.isPartial).toBe(false); // Because 1 < 50, we know it's not partial
    }
  });

  it("should mark as isPartial=true if returned items equal perPage", async () => {
    mockClient.getStore.mockResolvedValue({ id: 12345, name: "Test Store" });
    mockClient.get.mockResolvedValue([
      { id: 1, name: "P1", published: true, variants: [{ id: 11, price: "10", stock: 1 }] },
      { id: 2, name: "P2", published: true, variants: [{ id: 12, price: "10", stock: 1 }] }
    ]);

    const result = await adapter.getProducts(1, 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.isPartial).toBe(true);
    }
  });

  it("should not expose raw payloads in products or orders", async () => {
    mockClient.getStore.mockResolvedValue({ id: 12345, name: "Test Store" });
    mockClient.get.mockResolvedValue([
      { id: 100, currency: "BRL", total: "150.50", created_at: "2026-01-01T00:00:00Z", rawPII: "sensitive data" }
    ]);

    const result = await adapter.getOrders(1, 50);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The `raw` property in EcommerceOrder from `types.ts` is required, but it should be an empty object
      expect(result.snapshot.data[0]?.raw).toEqual({});
      expect((result.snapshot.data[0] as unknown as Record<string, unknown>).rawPII).toBeUndefined();
    }
  });

  it("should block if store ID mismatches", async () => {
    mockClient.getStore.mockResolvedValue({ id: 99999, name: "Wrong Store" });

    const result = await adapter.getProducts(1, 50);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe("BLOCKED");
    }
  });

  it("should handle NuvemshopApiError 401/403 as EXTERNAL_VALIDATION_PENDING", async () => {
    mockClient.getStore.mockRejectedValue(new NuvemshopApiError(401, "unauthorized", "{}"));

    const result = await adapter.getProducts(1, 50);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe("EXTERNAL_VALIDATION_PENDING");
    }
  });

  it("should handle NuvemshopApiError 429 as RATE_LIMITED", async () => {
    mockClient.getStore.mockRejectedValue(new NuvemshopApiError(429, "rate_limited", "{}"));

    const result = await adapter.getOrders(1, 50);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe("RATE_LIMITED");
    }
  });

  it("should handle malformed money payloads by erroring out", async () => {
    mockClient.getStore.mockResolvedValue({ id: 12345, name: "Test Store" });
    mockClient.get.mockResolvedValue([
      { id: 200, currency: "BRL", total: "invalid", created_at: "2026-10-01T12:00:00Z" }
    ]);

    const result = await adapter.getOrders(1, 50);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.status).toBe("ERROR");
      expect(result.error.reason).toContain("Malformed money");
    }
  });

  it("should fetch products successfully from page > 1", async () => {
    mockClient.getStore.mockResolvedValue({ id: 12345, name: "Test Store" });
    mockClient.get.mockResolvedValue([
      { id: 3, name: "P3", published: true, variants: [{ id: 13, price: "10", stock: 1 }] }
    ]);

    const result = await adapter.getProducts(2, 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.snapshot.data).toHaveLength(1);
      expect(result.snapshot.isPartial).toBe(false);
    }
  });
});
