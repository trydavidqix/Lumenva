import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type pg from "pg";
import { z } from "zod";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { scheduleCronJob } from "@/lib/agent-engine/cron/scheduler";
import type { JobRow } from "@/lib/agent-engine/queue/queue";
import {
  dialProductionVoiceRoute,
  resolveProductionVoiceOutboundRoute,
} from "@/lib/voice/outbound/production";

export const notificationDeliveryPayloadSchema = z.object({
  notification_id: z.string().uuid(),
  phase: z.enum(["initial", "voice"]),
}).strict();

const E164 = /^\+[1-9]\d{6,14}$/;
const TERMINAL = new Set(["acknowledged", "completed", "canceled"]);

interface NotificationRow {
  id: string;
  organization_id: string;
  contact_id: string;
  body: string;
  ack_token: string;
  status: string;
  scheduled_at: Date;
  escalation_at: Date;
  whatsapp_message_id: string | null;
  voice_call_id: string | null;
}

export interface NotificationDeliveryDeps {
  supabaseUrl: string;
  serviceRoleKey: string;
  internalSecret?: string;
  routerEnabled: boolean;
  voiceEnabled: boolean;
}

function genericWhatsappBody(row: NotificationRow): string {
  return [
    row.body,
    "",
    `Para confirmar, responde: CONFIRMAR ${row.ack_token}`,
  ].join("\n");
}

async function loadNotification(
  db: Pick<pg.Pool, "query">,
  job: JobRow,
  notificationId: string,
): Promise<NotificationRow> {
  const { rows } = await db.query<NotificationRow>(
    `select id, organization_id, contact_id, body, ack_token, status,
            scheduled_at, escalation_at, whatsapp_message_id, voice_call_id
       from notification_requests
      where id = $1 and organization_id = $2 and contact_id = $3
      limit 1`,
    [notificationId, job.organization_id, job.contact_id],
  );
  const row = rows[0];
  if (!row) throw new Error("notification_not_found_or_cross_tenant");
  return row;
}

async function recordAttempt(
  db: Pick<pg.Pool, "query">,
  row: NotificationRow,
  channel: "whatsapp" | "voice",
  status: "queued" | "sent" | "failed" | "skipped",
  externalId: string | null,
  errorCode: string | null = null,
): Promise<void> {
  const { rows } = await db.query<{ next_attempt: number }>(
    `select coalesce(max(attempt), 0)::int + 1 as next_attempt
       from notification_delivery_attempts
      where notification_id = $1 and channel = $2`,
    [row.id, channel],
  );
  const attempt = Math.min(rows[0]?.next_attempt ?? 1, 10);
  await db.query(
    `insert into notification_delivery_attempts
       (organization_id, notification_id, channel, attempt, status, external_id, error_code)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (notification_id, channel, attempt) do nothing`,
    [row.organization_id, row.id, channel, attempt, status, externalId, errorCode],
  );
}

async function ensureVoiceEscalationCron(
  db: pg.Pool,
  row: NotificationRow,
): Promise<void> {
  if (TERMINAL.has(row.status)) return;
  const { rows } = await db.query<{ id: string }>(
    `select id
       from cron_jobs
      where organization_id = $1
        and contact_id = $2
        and job_kind = 'notification_delivery'
        and payload->>'notification_id' = $3
        and payload->>'phase' = 'voice'
        and enabled = true
      limit 1`,
    [row.organization_id, row.contact_id, row.id],
  );
  if (rows[0]) return;
  await scheduleCronJob(db, row.organization_id, {
    leadId: row.contact_id,
    spec: { kind: "at", at: row.escalation_at },
    jobKind: "notification_delivery",
    payload: { notification_id: row.id, phase: "voice" },
    staggerWindowMs: 0,
    maxAttempts: 5,
  });
}

async function existingWhatsappMessage(
  db: Pick<pg.Pool, "query">,
  row: NotificationRow,
): Promise<{ id: string; status: string } | null> {
  const { rows } = await db.query<{ id: string; status: string }>(
    `select id, status
       from messages
      where organization_id = $1
        and contact_id = $2
        and direction = 'outbound'
        and metadata->>'notification_id' = $3
      order by created_at desc
      limit 1`,
    [row.organization_id, row.contact_id, row.id],
  );
  return rows[0] ?? null;
}

async function sendWhatsapp(
  db: pg.Pool,
  supabase: SupabaseClient,
  row: NotificationRow,
  requestId: string,
): Promise<void> {
  const already = await existingWhatsappMessage(db, row);
  if (already) {
    await db.query(
      `update notification_requests
          set whatsapp_message_id = $2,
              status = case when status = 'scheduled' then 'whatsapp_sent' else status end,
              updated_at = now()
        where id = $1`,
      [row.id, already.id],
    );
    return;
  }

  const { rows } = await db.query<{ id: string }>(
    `select id
       from conversations
      where organization_id = $1 and contact_id = $2
      order by last_message_at desc nulls last, created_at desc
      limit 1`,
    [row.organization_id, row.contact_id],
  );
  const conversationId = rows[0]?.id;
  if (!conversationId) throw new Error("notification_conversation_not_found");

  await db.query(
    `update notification_requests
        set status = 'whatsapp_pending', updated_at = now()
      where id = $1 and status = 'scheduled'`,
    [row.id],
  );

  const message = await sendMessageHandler(
    supabase,
    {
      organization_id: row.organization_id,
      actor: { type: "webhook_source", id: "notification-router" },
      requestId,
    },
    {
      conversation_id: conversationId,
      type: "text",
      body: genericWhatsappBody(row),
      metadata: {
        notification_id: row.id,
        notification_ack_token: row.ack_token,
      },
    } as Parameters<typeof sendMessageHandler>[2],
  );

  const accepted = message.status !== "failed";
  await recordAttempt(
    db,
    row,
    "whatsapp",
    accepted ? (message.status === "sent" ? "sent" : "queued") : "failed",
    message.external_id ?? message.id,
    accepted ? null : (message.error_code ?? "whatsapp_failed"),
  );
  if (!accepted) throw new Error(message.error_code ?? "notification_whatsapp_failed");

  await db.query(
    `update notification_requests
        set whatsapp_message_id = $2, status = 'whatsapp_sent',
            last_error_code = null, updated_at = now()
      where id = $1`,
    [row.id, message.id],
  );
}

interface ReservedVoice {
  row: NotificationRow;
  voiceCallId: string;
  callState: string;
  phoneE164: string;
  route: NonNullable<Awaited<ReturnType<typeof resolveProductionVoiceOutboundRoute>>>;
}

async function reserveVoiceCall(
  pool: pg.Pool,
  job: JobRow,
  notificationId: string,
): Promise<ReservedVoice | null> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows } = await client.query<NotificationRow>(
      `select id, organization_id, contact_id, body, ack_token, status,
              scheduled_at, escalation_at, whatsapp_message_id, voice_call_id
         from notification_requests
        where id = $1 and organization_id = $2 and contact_id = $3
        for update`,
      [notificationId, job.organization_id, job.contact_id],
    );
    const row = rows[0];
    if (!row) throw new Error("notification_not_found_or_cross_tenant");
    if (TERMINAL.has(row.status)) {
      await client.query("commit");
      return null;
    }

    const route = await resolveProductionVoiceOutboundRoute(client as unknown as pg.Pool, row.organization_id);
    if (!route) throw new Error("notification_voice_route_unavailable");

    const contact = await client.query<{ phone_number: string | null }>(
      `select phone_number from contacts
        where organization_id = $1 and id = $2 limit 1`,
      [row.organization_id, row.contact_id],
    );
    const phoneE164 = contact.rows[0]?.phone_number?.trim() ?? "";
    if (!E164.test(phoneE164)) throw new Error("notification_contact_phone_invalid");

    let voiceCallId = row.voice_call_id;
    let callState = "queued";
    if (voiceCallId) {
      const existing = await client.query<{ state: string }>(
        `select state from voice_calls
          where id = $1 and organization_id = $2 and contact_id = $3 limit 1`,
        [voiceCallId, row.organization_id, row.contact_id],
      );
      callState = existing.rows[0]?.state ?? "missing";
      // A known in-flight/terminal successful call must never be dialed twice.
      if (["ringing","connecting","active","held","transferring","completed"].includes(callState)) {
        await client.query(
          `update notification_requests
              set status = case when $2 = 'completed' then 'completed' else 'voice_queued' end,
                  completed_at = case when $2 = 'completed' then coalesce(completed_at, now()) else completed_at end,
                  updated_at = now()
            where id = $1`,
          [row.id, callState],
        );
        await client.query("commit");
        return { row, voiceCallId, callState, phoneE164, route };
      }
    }

    if (!voiceCallId || ["failed","canceled","missing"].includes(callState)) {
      const inserted = await client.query<{ id: string }>(
        `insert into voice_calls
           (organization_id, contact_id, agent_id, direction, caller_number, called_number, state, provider)
         values ($1,$2,null,'outbound',$3,$4,'queued',$5)
         returning id`,
        [row.organization_id, row.contact_id, route.phoneE164, phoneE164, route.provider],
      );
      voiceCallId = inserted.rows[0]?.id ?? null;
      if (!voiceCallId) throw new Error("notification_voice_call_reservation_failed");
      callState = "queued";
      await client.query(
        `update notification_requests
            set voice_call_id = $2, status = 'voice_pending',
                last_error_code = null, updated_at = now()
          where id = $1`,
        [row.id, voiceCallId],
      );
    }

    await client.query("commit");
    return { row: { ...row, voice_call_id: voiceCallId }, voiceCallId, callState, phoneE164, route };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function sendVoice(
  pool: pg.Pool,
  job: JobRow,
  notificationId: string,
  internalSecret: string,
): Promise<void> {
  const reserved = await reserveVoiceCall(pool, job, notificationId);
  if (!reserved) return;

  if (["ringing","connecting","active","held","transferring","completed"].includes(reserved.callState)) {
    await recordAttempt(pool, reserved.row, "voice", "skipped", reserved.voiceCallId, null);
    return;
  }

  try {
    await dialProductionVoiceRoute(reserved.route, internalSecret, {
      voiceCallId: reserved.voiceCallId,
      organizationId: reserved.row.organization_id,
      contactId: reserved.row.contact_id,
      agentId: "notification-router",
      goal: "deliver_scheduled_notification",
      toE164: reserved.phoneE164,
      firstMessage: reserved.row.body,
    });
    await recordAttempt(pool, reserved.row, "voice", "sent", reserved.voiceCallId);
    await pool.query(
      `update notification_requests
          set status = 'voice_queued', last_error_code = null, updated_at = now()
        where id = $1 and acknowledged_at is null`,
      [reserved.row.id],
    );
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : "voice_delivery_failed";
    await recordAttempt(pool, reserved.row, "voice", "failed", reserved.voiceCallId, code);
    await pool.query(
      `update notification_requests
          set last_error_code = $2, updated_at = now()
        where id = $1`,
      [reserved.row.id, code],
    );
    // Do not mark the reserved call failed here: a client-side timeout can be
    // ambiguous. The worker records "connecting" before replying 202; retry
    // inspects voice_calls.state and therefore will not double-dial a call that
    // actually started.
    throw error;
  }
}

export function createNotificationDeliveryHandler(deps: NotificationDeliveryDeps) {
  const supabase = createClient(deps.supabaseUrl, deps.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return async function handleNotificationDelivery(job: JobRow, pool: pg.Pool): Promise<void> {
    if (!deps.routerEnabled) throw new Error("notification_router_disabled");
    if (!job.contact_id) throw new Error("notification_delivery_requires_contact");

    const payload = notificationDeliveryPayloadSchema.parse(job.payload);
    const row = await loadNotification(pool, job, payload.notification_id);
    if (TERMINAL.has(row.status)) {
      await recordAttempt(pool, row, payload.phase === "initial" ? "whatsapp" : "voice", "skipped", null);
      return;
    }

    if (payload.phase === "initial") {
      await sendWhatsapp(pool, supabase, row, `notification:${row.id}`);
      const refreshed = await loadNotification(pool, job, row.id);
      await ensureVoiceEscalationCron(pool, refreshed);
      return;
    }

    if (!deps.voiceEnabled) throw new Error("voice_notification_disabled");
    if (!deps.internalSecret) throw new Error("notification_internal_secret_missing");
    await sendVoice(pool, job, row.id, deps.internalSecret);
  };
}
