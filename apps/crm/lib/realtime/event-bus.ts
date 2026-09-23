import { createAdminClient } from "@/lib/supabase/admin";
import type { EventRow } from "@/lib/event-log/dispatcher";
import { logger } from "@/lib/logger";

export async function pollEvents(
  organizationId: string,
  cursorAt: Date,
  limit = 100
): Promise<(EventRow & { created_at: string })[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("event_log")
    .select("id, organization_id, event_type, entity_kind, entity_id, payload, metadata, consumed_by, attempts, created_at")
    .eq("organization_id", organizationId)
    .gt("created_at", cursorAt.toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    logger.error("[event-bus.pollEvents] Failed to poll event_log", { error: error.message });
    return [];
  }

  return (data ?? []) as unknown as (EventRow & { created_at: string })[];
}
