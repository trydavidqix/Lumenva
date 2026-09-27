import type { SupabaseClient } from "@supabase/supabase-js";

const ACK_COMMAND = /^CONFIRMAR\s+([A-Z0-9]{6})$/i;

export function parseNotificationAckToken(input: string): string | null {
  const match = ACK_COMMAND.exec(input.trim());
  return match?.[1]?.toUpperCase() ?? null;
}

export interface NotificationAckResult {
  acknowledged: boolean;
  notificationId: string | null;
}

export async function tryAcknowledgeNotification(
  admin: SupabaseClient,
  input: { organizationId: string; contactId: string; body: string },
): Promise<NotificationAckResult> {
  const token = parseNotificationAckToken(input.body);
  if (!token) return { acknowledged: false, notificationId: null };

  const { data: found, error: findError } = await admin
    .from("notification_requests")
    .select("id,status")
    .eq("organization_id", input.organizationId)
    .eq("contact_id", input.contactId)
    .eq("ack_token", token)
    .in("status", ["scheduled", "whatsapp_pending", "whatsapp_sent", "voice_pending", "voice_queued", "failed"])
    .maybeSingle();

  if (findError) throw new Error(`notification_ack_lookup_failed:${findError.message}`);
  if (!found) return { acknowledged: false, notificationId: null };

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("notification_requests")
    .update({
      status: "acknowledged",
      acknowledged_at: now,
      completed_at: now,
      updated_at: now,
      last_error_code: null,
    })
    .eq("id", found.id)
    .eq("organization_id", input.organizationId)
    .is("acknowledged_at", null)
    .select("id")
    .maybeSingle();

  if (updateError) throw new Error(`notification_ack_update_failed:${updateError.message}`);

  if (updated) {
    // The status transition is authoritative; timer cancellation is best-effort.
    await admin
      .from("cron_jobs")
      .update({ enabled: false, updated_at: now })
      .eq("organization_id", input.organizationId)
      .eq("contact_id", input.contactId)
      .eq("job_kind", "notification_delivery")
      .eq("enabled", true)
      .contains("payload", { notification_id: found.id })
      .then(() => undefined, () => undefined);
  }

  return {
    acknowledged: updated !== null,
    notificationId: updated?.id ?? found.id,
  };
}
