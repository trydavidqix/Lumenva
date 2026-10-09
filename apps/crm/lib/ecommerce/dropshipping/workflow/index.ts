/**
 * Dropshipping Approval Workflow
 *
 * NOTE: Full durable approval is blocked due to missing schema capabilities
 * in `public.orders` (e.g., approval_status, supplier_id, approved_by).
 * Do not implement ephemeral in-memory state or modify the schema.
 * This workflow currently provides read-only views mapped to existing statuses.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, external_id, external_provider, status, total_cents, currency, ordered_at")
    .eq("organization_id", organizationId)
    .order("ordered_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch orders: ${error.message}`);
  }

  return data.map((row) => ({
    id: row.id,
    externalId: row.external_id,
    provider: row.external_provider,
    status: row.status,
    totalCents: Number(row.total_cents),
    currency: row.currency,
    orderedAt: row.ordered_at,
  }));
}
