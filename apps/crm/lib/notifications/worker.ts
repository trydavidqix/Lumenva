import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type pg from "pg";
import { z } from "zod";

import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { scheduleCronJob } from "@/lib/agent-engine/cron/scheduler";
import type { JobRow, Queryable } from "@/lib/agent-engine/queue/queue";
import {
  DEFAULT_NOTIFICATION_DELIVERY_POLICY,
  evaluateVoicePolicy,
  type NotificationDeliveryPolicy,
  type VoicePolicySnapshot,
} from "@/lib/notifications/policy";
import {
  dialProductionVoiceRoute,
  resolveProductionVoiceOutboundRoute,
} from "@/lib/voice/outbound/production";

export const notificationDeliveryPayloadSchema = z.object({
  notification_id: z.string().uuid(),
  phase: z.enum(["initial", "voice"]),
}).strict();

const E164 = /^\+[1-9]\d{6,14}$/;
const SAFE_VOICE_REMINDER = "Tens um lembrete programado. Confere a aplicação para os detalhes.";
const TERMINAL = new Set(["acknowledged", "completed", "failed", "canceled"]);

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

interface NotificationPolicyRow {
  timezone: string;
  voice_escalation_enabled: boolean;
  allowed_voice_destinations: string[];
  whatsapp_max_attempts: number;
  voice_max_attempts: number;
  max_voice_calls_per_hour: number;
  max_voice_calls_per_day: number;
  voice_cooldown_seconds: number;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
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
  db: Queryable,
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

async function loadDeliveryPolicy(
  db: Queryable,
  organizationId: string,
): Promise<NotificationDeliveryPolicy> {
  const { rows } = await db.query<NotificationPolicyRow>(
    `select timezone, voice_escalation_enabled, allowed_voice_destinations,
            whatsapp_max_attempts, voice_max_attempts,
            max_voice_calls_per_hour, max_voice_calls_per_day,
            voice_cooldown_seconds, quiet_hours_start, quiet_hours_end
       from notification_delivery_policies
      where organization_id = $1
      limit 1`,
    [organizationId],
  );
  const row = rows[0];
  if (!row) return { ...DEFAULT_NOTIFICATION_DELIVERY_POLICY, allowedVoiceDestinations: [] };
  return {
    timezone: row.timezone,
    voiceEscalationEnabled: row.voice_escalation_enabled,
    allowedVoiceDestinations: [...row.allowed_voice_destinations],
    whatsappMaxAttempts: row.whatsapp_max_attempts,
    voiceMaxAttempts: row.voice_max_attempts,
    maxVoiceCallsPerHour: row.max_voice_calls_per_hour,
    maxVoiceCallsPerDay: row.max_voice_calls_per_day,
    voiceCooldownSeconds: row.voice_cooldown_seconds,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
  };
}

async function countAttempts(
  db: Queryable,
  notificationId: string,
  channel: "whatsapp" | "voice",
): Promise<number> {
  const { rows } = await db.query<{ count: number }>(
    `select count(*)::int as count
       from notification_delivery_attempts
      where notification_id = $1
        and channel = $2
        and status <> 'skipped'`,
    [notificationId, channel],
  );
  return rows[0]?.count ?? 0;
}

async function recordAttempt(
  db: Queryable,
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

async function markNotificationFailed(
  db: Queryable,
  row: NotificationRow,
  reason: string,
): Promise<void> {
  await db.query(
    `update notification_requests
        set status = 'failed', last_error_code = $2, updated_at = now()
      where id = $1 and acknowledged_at is null`,
    [row.id, reason.slice(0, 120)],
  );
}

async function ensureVoiceEscalationCron(
  db: pg.Pool,
  row: NotificationRow,
  at: Date = row.escalation_at,
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
    spec: { kind: "at", at },
    jobKind: "notification_delivery",
    payload: { notification_id: row.id, phase: "voice" },
    staggerWindowMs: 0,
    maxAttempts: 5,
  });
}

async function existingWhatsappMessage(
  db: Queryable,
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
              status = case when status in ('scheduled','whatsapp_pending') then 'whatsapp_sent' else status end,
              updated_at = now()
        where id = $1`,
      [row.id, already.id],
    );
    return;
  }

  const policy = await loadDeliveryPolicy(db, row.organization_id);
  const attemptsBefore = await countAttempts(db, row.id, "whatsapp");
  if (attemptsBefore >= policy.whatsappMaxAttempts) {
    await recordAttempt(db, row, "whatsapp", "skipped", null, "whatsapp_attempts_exhausted");
    await markNotificationFailed(db, row, "whatsapp_attempts_exhausted");
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
  if (!conversationId) {
    await recordAttempt(db, row, "whatsapp", "failed", null, "notification_conversation_not_found");
    if (attemptsBefore + 1 >= policy.whatsappMaxAttempts) {
      await markNotificationFailed(db, row, "notification_conversation_not_found");
      return;
    }
    throw new Error("notification_conversation_not_found");
  }

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
  if (!accepted) {
    const code = message.error_code ?? "notification_whatsapp_failed";
    if (attemptsBefore + 1 >= policy.whatsappMaxAttempts) {
      await markNotificationFailed(db, row, code);
      return;
    }
    throw new Error(code);
  }

  await db.query(
    `update notification_requests
        set whatsapp_message_id = $2, status = 'whatsapp_sent',
            last_error_code = null, updated_at = now()
      where id = $1 and acknowledged_at is null`,
    [row.id, message.id],
  );
}

interface VoiceCallContext {
  row: NotificationRow;
  voiceCallId: string;
  phoneE164: string;
  route: NonNullable<Awaited<ReturnType<typeof resolveProductionVoiceOutboundRoute>>>;
}

type VoiceReservation =
  | { kind: "terminal"; row: NotificationRow }
  | { kind: "blocked"; row: NotificationRow; reason: string }
  | { kind: "deferred"; row: NotificationRow; reason: string; retryAt: Date }
  | { kind: "existing"; row: NotificationRow; voiceCallId: string; callState: string }
  | ({ kind: "reserved" } & VoiceCallContext);

async function reserveVoiceCall(
  pool: pg.Pool,
  job: JobRow,
  notificationId: string,
): Promise<VoiceReservation> {
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
      return { kind: "terminal", row };
    }

    // Serializes anti-fraud accounting and the actual voice_call reservation
    // per tenant. Two workers cannot both observe "one slot left" and consume it.
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`notification-voice:${row.organization_id}`],
    );

    let voiceCallId = row.voice_call_id;
    if (voiceCallId) {
      const existing = await client.query<{ state: string }>(
        `select state from voice_calls
          where id = $1 and organization_id = $2 and contact_id = $3 limit 1`,
        [voiceCallId, row.organization_id, row.contact_id],
      );
      const callState = existing.rows[0]?.state ?? "missing";
      if (["ringing", "connecting", "active", "held", "transferring", "completed"].includes(callState)) {
        await client.query(
          `update notification_requests
              set status = case when $2 = 'completed' then 'completed' else 'voice_queued' end,
                  completed_at = case when $2 = 'completed' then coalesce(completed_at, now()) else completed_at end,
                  updated_at = now()
            where id = $1`,
          [row.id, callState],
        );
        await client.query("commit");
        return { kind: "existing", row, voiceCallId, callState };
      }
    }

    const contact = await client.query<{ phone_number: string | null }>(
      `select phone_number from contacts
        where organization_id = $1 and id = $2 limit 1`,
      [row.organization_id, row.contact_id],
    );
    const phoneE164 = contact.rows[0]?.phone_number?.trim() ?? "";
    if (!E164.test(phoneE164)) {
      await client.query(
        `update notification_requests
            set status = 'failed', last_error_code = 'notification_contact_phone_invalid', updated_at = now()
          where id = $1`,
        [row.id],
      );
      await client.query("commit");
      return { kind: "blocked", row, reason: "notification_contact_phone_invalid" };
    }

    const policy = await loadDeliveryPolicy(client, row.organization_id);
    const attempts = await countAttempts(client, row.id, "voice");
    const stats = await client.query<{
      calls_last_hour: number;
      calls_last_day: number;
      last_call_at: Date | null;
      oldest_call_last_hour_at: Date | null;
      oldest_call_last_day_at: Date | null;
    }>(
      `select
         (count(*) filter (where created_at >= now() - interval '1 hour'))::int as calls_last_hour,
         (count(*) filter (where created_at >= now() - interval '24 hours'))::int as calls_last_day,
         max(created_at) as last_call_at,
         min(created_at) filter (where created_at >= now() - interval '1 hour') as oldest_call_last_hour_at,
         min(created_at) filter (where created_at >= now() - interval '24 hours') as oldest_call_last_day_at
       from voice_calls
      where organization_id = $1 and direction = 'outbound'`,
      [row.organization_id],
    );
    const stat = stats.rows[0];
    const snapshot: VoicePolicySnapshot = {
      notificationVoiceAttempts: attempts,
      callsLastHour: stat?.calls_last_hour ?? 0,
      callsLastDay: stat?.calls_last_day ?? 0,
      lastCallAt: stat?.last_call_at ?? null,
      oldestCallLastHourAt: stat?.oldest_call_last_hour_at ?? null,
      oldestCallLastDayAt: stat?.oldest_call_last_day_at ?? null,
    };
    const decision = evaluateVoicePolicy({
      now: new Date(),
      destination: phoneE164,
      policy,
      snapshot,
    });

    if (decision.kind === "block") {
      await client.query(
        `update notification_requests
            set status = 'failed', last_error_code = $2, updated_at = now()
          where id = $1 and acknowledged_at is null`,
        [row.id, decision.reason],
      );
      await client.query("commit");
      return { kind: "blocked", row, reason: decision.reason };
    }
    if (decision.kind === "defer") {
      await client.query(
        `update notification_requests
            set status = 'voice_pending', last_error_code = $2, updated_at = now()
          where id = $1 and acknowledged_at is null`,
        [row.id, decision.reason],
      );
      await client.query("commit");
      return {
        kind: "deferred",
        row: { ...row, status: "voice_pending" },
        reason: decision.reason,
        retryAt: decision.retryAt,
      };
    }

    const route = await resolveProductionVoiceOutboundRoute(
      client as unknown as pg.Pool,
      row.organization_id,
    );
    if (!route) {
      await client.query(
        `update notification_requests
            set status = 'failed', last_error_code = 'notification_voice_route_unavailable', updated_at = now()
          where id = $1 and acknowledged_at is null`,
        [row.id],
      );
      await client.query("commit");
      return { kind: "blocked", row, reason: "notification_voice_route_unavailable" };
    }

    let callState = "queued";
    if (voiceCallId) {
      const existing = await client.query<{ state: string }>(
        `select state from voice_calls
          where id = $1 and organization_id = $2 and contact_id = $3 limit 1`,
        [voiceCallId, row.organization_id, row.contact_id],
      );
      callState = existing.rows[0]?.state ?? "missing";
    }
    if (!voiceCallId || ["failed", "canceled", "missing"].includes(callState)) {
      const inserted = await client.query<{ id: string }>(
        `insert into voice_calls
           (organization_id, contact_id, agent_id, direction, caller_number, called_number, state, provider)
         values ($1,$2,null,'outbound',$3,$4,'queued',$5)
         returning id`,
        [row.organization_id, row.contact_id, route.phoneE164, phoneE164, route.provider],
      );
      voiceCallId = inserted.rows[0]?.id ?? null;
      if (!voiceCallId) throw new Error("notification_voice_call_reservation_failed");
      await client.query(
        `update notification_requests
            set voice_call_id = $2, status = 'voice_pending',
                last_error_code = null, updated_at = now()
          where id = $1 and acknowledged_at is null`,
        [row.id, voiceCallId],
      );
    }

    await client.query("commit");
    return {
      kind: "reserved",
      row: { ...row, voice_call_id: voiceCallId },
      voiceCallId,
      phoneE164,
      route,
    };
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

  if (reserved.kind === "terminal") return;
  if (reserved.kind === "blocked") {
    await recordAttempt(pool, reserved.row, "voice", "skipped", null, reserved.reason);
    return;
  }
  if (reserved.kind === "deferred") {
    await recordAttempt(pool, reserved.row, "voice", "skipped", null, reserved.reason);
    await ensureVoiceEscalationCron(pool, reserved.row, reserved.retryAt);
    return;
  }
  if (reserved.kind === "existing") {
    await recordAttempt(
      pool,
      reserved.row,
      "voice",
      "skipped",
      reserved.voiceCallId,
      `voice_call_${reserved.callState}`,
    );
    return;
  }

  // Acknowledgement can race with the short gap between the DB reservation and
  // the external dial. Recheck immediately before crossing the network boundary.
  const latest = await pool.query<{ status: string }>(
    `select status from notification_requests
      where id = $1 and organization_id = $2 limit 1`,
    [reserved.row.id, reserved.row.organization_id],
  );
  if (TERMINAL.has(latest.rows[0]?.status ?? "failed")) {
    await pool.query(
      `update voice_calls
          set state = 'canceled', ended_at = coalesce(ended_at, now()), updated_at = now()
        where id = $1 and organization_id = $2 and state = 'queued'`,
      [reserved.voiceCallId, reserved.row.organization_id],
    );
    await recordAttempt(
      pool,
      reserved.row,
      "voice",
      "skipped",
      reserved.voiceCallId,
      "notification_became_terminal_before_dial",
    );
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
      // Never read the potentially sensitive WhatsApp reminder body aloud.
      // Rich voice content requires a future explicit policy; default stays generic.
      firstMessage: SAFE_VOICE_REMINDER,
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
        where id = $1 and acknowledged_at is null`,
      [reserved.row.id, code],
    );
    // Do not force the reserved voice_call to failed here: a client-side HTTP
    // timeout is ambiguous. The SIP worker records "connecting" before replying
    // 202, and a retry inspects voice_calls.state before attempting any redial.
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
      await recordAttempt(
        pool,
        row,
        payload.phase === "initial" ? "whatsapp" : "voice",
        "skipped",
        null,
        "notification_terminal",
      );
      return;
    }

    if (payload.phase === "initial") {
      await sendWhatsapp(pool, supabase, row, `notification:${row.id}`);
      const refreshed = await loadNotification(pool, job, row.id);
      if (!TERMINAL.has(refreshed.status)) {
        await ensureVoiceEscalationCron(pool, refreshed);
      }
      return;
    }

    if (!deps.voiceEnabled) {
      await recordAttempt(pool, row, "voice", "skipped", null, "voice_notification_disabled");
      return;
    }
    if (!deps.internalSecret) throw new Error("notification_internal_secret_missing");
    await sendVoice(pool, job, row.id, deps.internalSecret);
  };
}
