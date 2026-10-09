/**
 * Dropshipping Approval Workflow
 *
 * NOTE: Full durable approval is blocked due to missing schema capabilities
 * in `public.orders` (e.g., approval_status, supplier_id, approved_by).
 * Do not implement ephemeral in-memory state or modify the schema.
 * This workflow currently provides read-only views mapped to existing statuses.
 */
import { createAdminClient } from "@/lib/supabase/admin";

export type DropshippingOrderSummary = {
  id: string;
  externalId: string;
  provider: string;
  status: string;
  totalCents: number;
  currency: string;
  orderedAt: string;
};

export async function getDropshippingOrders(
  organizationId: string,
  limit: number = 50
): Promise<DropshippingOrderSummary[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, external_id, external_provider, status, total_cents, currency, ordered_at")
    .eq("organization_id", organizationId)
    .order("ordered_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  // Ensure data is typed correctly before mapping to avoid any implicitly having 'any' type.
  const rows = data as Array<{
    id: string;
    external_id: string;
    external_provider: string;
    status: string;
    total_cents: number;
    currency: string;
    ordered_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    externalId: row.external_id,
    provider: row.external_provider,
    status: row.status,
    totalCents: Number(row.total_cents),
    currency: row.currency,
    orderedAt: row.ordered_at,
  }));
}
