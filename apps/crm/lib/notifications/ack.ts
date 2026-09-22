import type { SupabaseClient } from "@supabase/supabase-js";

const ACK = /(?:^|\\s)CONFIRMAR\\s+([A-Z0-9]{6})(?:\\s|$)/i;

export interface NotificationAckResult {
  acknowledged: boolean;
  notificationId: string | null;
}

/**
 * Deterministic acknowledgement for reminder notifications.
 *
 * No LLM: only an explicit CONFIRMAR + token can acknowledge. This prevents an
 * ordinary "ok" in a customer conversation from accidentally canceling an
 * unrelated escalation.
 */
export async function tryAcknowledgeNotification(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    contactId: string;
    body: string;
  },
): Promise<NotificationAckResult> {
  const token = ACK.exec(input.body.trim())?.[1]?.toUpperCase();
  if (!token) return { acknowledged: false, notificationId: null };

  const { data: found, error: findError } = await admin
    .from("notification_requests")
    .select("id,status")
    .eq("organization_id", input.organizationId)
    .eq("contact_id", input.contactId)
    .eq("ack_token", token)
    .in("status", ["scheduled", "whatsapp_pending", "whatsapp_sent", "voice_pending", "voice_queued"])
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
  return {
    acknowledged: updated !== null,
    notificationId: updated?.id ?? found.id,
  };
}
