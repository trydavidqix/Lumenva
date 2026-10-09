import { describe, it, expect, vi } from "vitest";
import { getDropshippingOrders } from "../index";

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue({
    data: [
      {
        id: "123",
        external_id: "ext-123",
        external_provider: "nuvemshop",
        status: "open",
        total_cents: 1000,
        currency: "BRL",
        ordered_at: "2023-01-01T00:00:00Z",
        organization_id: "org-1"
      }
    ],
    error: null
  })
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mockSupabase
}));

describe("Dropshipping Workflow", () => {
  it("fetches orders mapped to DropshippingOrderSummary and filters by organization_id", async () => {
    const orgId = "org-1";
    const orders = await getDropshippingOrders(orgId);

    // Verify isolation - must eq on organization_id
    expect(mockSupabase.eq).toHaveBeenCalledWith("organization_id", orgId);

    expect(orders).toHaveLength(1);
    expect(orders[0]).toEqual({
      id: "123",
      externalId: "ext-123",
      provider: "nuvemshop",
      status: "open",
      totalCents: 1000,
      currency: "BRL",
      orderedAt: "2023-01-01T00:00:00Z"
    });
  });

  it("handles errors from database", async () => {
    mockSupabase.limit.mockResolvedValueOnce({
      data: null,
      error: { message: "Database error" }
    });

    await expect(getDropshippingOrders("org-1")).rejects.toThrow("Failed to fetch orders: Database error");
  });
});
