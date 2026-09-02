import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { bearerFromHeader, cronSecretMatches } from "@/lib/auth/cron-secret";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendMessageHandler } from "@/app/api/v1/messages/_handler";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ENDPOINT_TAG = "/api/internal/notifications/email";
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT = 120;
const RATE_WINDOW_SEC = 60;

export const emailNotificationSchema = z.object({
  message_id: z.string().trim().min(1).max(200),
  thread_id: z.string().trim().min(1).max(200),
  from: z.string().trim().min(1).max(320),
  to: z.string().trim().min(1).max(320),
  subject: z.string().trim().min(1).max(500),
  summary: z.string().trim().min(1).max(4000),
  action: z.string().trim().min(1).max(1000),
  deadline: z.string().trim().min(1).max(200),
  urgency: z.string().trim().min(1).max(100),
  source: z.string().trim().min(1).max(100),
});

type EmailNotification = z.infer<typeof emailNotificationSchema>;

function requestHash(input: EmailNotification): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function formatEmailNotification(input: EmailNotification): string {
  return [
    "📧 Novo e-mail Lumenva",
    "",
    `De: ${input.from}`,
    `Assunto: ${input.subject}`,
    "",
    "Resumo:",
    input.summary,
    "",
    "Ação:",
    input.action,
    "",
    "Prazo:",
    input.deadline,
    "",
    "Urgência:",
    input.urgency,
  ].join("\n");
}

function safeAudit(action: "email.relay_received" | "email.relay_duplicate" | "email.relay_succeeded" | "email.relay_failed", requestId: string, organizationId: string, metadata: Record<string, unknown> = {}) {
  void audit({ action, organizationId, requestId, resourceType: "email_notification", metadata });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const provided = bearerFromHeader(req.headers.get("authorization"));
  if (!cronSecretMatches(provided)) {
    return fail("unauthenticated", "Authentication required.", 401, { requestId });
  }

  const rl = await checkRateLimit("email_notification_relay", RATE_LIMIT, RATE_WINDOW_SEC);
  if (!rl.allowed) {
    return fail("rate_limited", "Too many requests.", 429, {
      requestId,
      headers: { "Retry-After": String(RATE_WINDOW_SEC) },
    });
  }

  let input: EmailNotification;
  try {
    input = emailNotificationSchema.parse(await req.json());
  } catch {
    return fail("validation_failed", "Invalid email notification payload.", 400, { requestId });
  }

  const organizationId = env.EMAIL_RELAY_ORGANIZATION_ID;
  const ownerPhone = env.EMAIL_RELAY_OWNER_WHATSAPP_E164;
  if (!organizationId || !ownerPhone) {
    safeAudit("email.relay_failed", requestId, organizationId || "", { reason: "owner_not_configured" });
    return fail("not_configured", "Email relay owner is not configured.", 503, { requestId });
  }

  const admin = createAdminClient();
  const hash = requestHash(input);
  const { error: reserveError } = await admin.from("idempotency_keys").insert({
    organization_id: organizationId,
    endpoint: ENDPOINT_TAG,
    key: input.message_id,
    request_hash: hash,
    response_body: {},
    status_code: 0,
    expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString(),
  });

  if (reserveError) {
    if (reserveError.code !== "23505") {
      logger.error("email relay idempotency reservation failed", { error: reserveError.message });
      return fail("internal_error", "Unable to reserve notification.", 500, { requestId });
    }
    const { data: existing } = await admin.from("idempotency_keys")
      .select("request_hash, response_body, status_code")
      .eq("organization_id", organizationId).eq("endpoint", ENDPOINT_TAG).eq("key", input.message_id).maybeSingle();
    if (!existing || existing.request_hash !== hash) {
      return fail("idempotency_conflict", "message_id already used with different content.", 409, { requestId });
    }
    safeAudit("email.relay_duplicate", requestId, organizationId, { status: existing.status_code });
    if (existing.status_code === 0) return fail("state_conflict", "Notification is already in progress.", 409, { requestId });
    return ok({ ...(existing.response_body as Record<string, unknown>), deduplicated: true }, { requestId });
  }

  safeAudit("email.relay_received", requestId, organizationId, { source: input.source });
  let response: Record<string, unknown>;
  try {
    response = env.EMAIL_RELAY_DRY_RUN
      ? { accepted: true, dry_run: true, message_id: input.message_id }
      : await sendToConfiguredOwner(admin, organizationId, ownerPhone, input, requestId);
  } catch (error) {
    await admin.from("idempotency_keys").delete()
      .eq("organization_id", organizationId).eq("endpoint", ENDPOINT_TAG).eq("key", input.message_id).eq("status_code", 0);
    safeAudit("email.relay_failed", requestId, organizationId, { reason: error instanceof Error ? error.message : "send_failed" });
    if (error instanceof Error && error.message === "email_relay_owner_not_authorized") {
      return fail("forbidden", "Configured owner destination is not authorized.", 403, { requestId });
    }
    return fail("internal_error", "Email notification could not be delivered.", 502, { requestId });
  }

  await admin.from("idempotency_keys").update({ response_body: response, status_code: 200 })
    .eq("organization_id", organizationId).eq("endpoint", ENDPOINT_TAG).eq("key", input.message_id);
  safeAudit("email.relay_succeeded", requestId, organizationId, { dry_run: env.EMAIL_RELAY_DRY_RUN });
  return ok(response, { requestId });
}

async function sendToConfiguredOwner(admin: ReturnType<typeof createAdminClient>, organizationId: string, ownerPhone: string, input: EmailNotification, requestId: string) {
  const { data: contact, error: contactError } = await admin.from("contacts").select("id, phone_number").eq("organization_id", organizationId).eq("phone_number", ownerPhone).maybeSingle();
  if (contactError || !contact) throw new Error("email_relay_owner_contact_not_found");
  if (contact.phone_number !== ownerPhone) throw new Error("email_relay_owner_not_authorized");
  const { data: conversation, error: conversationError } = await admin.from("conversations").select("id").eq("organization_id", organizationId).eq("contact_id", contact.id).order("last_message_at", { ascending: false }).limit(1).maybeSingle();
  if (conversationError || !conversation) throw new Error("email_relay_owner_conversation_not_found");
  const message = await sendMessageHandler(admin, { organization_id: organizationId, actor: { type: "webhook_source", id: "email-relay" }, requestId }, { conversation_id: conversation.id, type: "text", body: formatEmailNotification(input), metadata: { email_relay_message_id: input.message_id, email_relay_thread_id: input.thread_id } });
  return { accepted: true, dry_run: false, message_id: input.message_id, crm_message_id: message.id, status: message.status };
}
