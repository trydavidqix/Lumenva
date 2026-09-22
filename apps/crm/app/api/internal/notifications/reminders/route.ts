import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { scheduleCronJob } from "@/lib/agent-engine/cron/scheduler";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_REMINDER = "Tens um lembrete programado. Confere a aplicação para os detalhes.";

const bodySchema = z.object({
  contact_id: z.string().uuid(),
  idempotency_key: z.string().trim().min(1).max(160),
  scheduled_at: z.string().datetime({ offset: true }),
  escalation_after_minutes: z.number().int().min(1).max(24 * 60).default(10),
  body: z.string().trim().min(1).max(500).default(DEFAULT_REMINDER),
}).strict();

interface NotificationRow {
  id: string;
  organization_id: string;
  contact_id: string;
  idempotency_key: string;
  body: string;
  ack_token: string;
  status: string;
  scheduled_at: Date;
  escalation_at: Date;
}

function authorized(req: NextRequest): boolean {
  const expected = env.INTERNAL_SECRET;
  if (!expected) return false;
  const header = req.headers.get("x-internal-secret") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim() ?? "";
  return [header, bearer].some(
    (provided) =>
      provided.length === expected.length &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(expected)),
  );
}

function organizationId(req: NextRequest): string | null {
  const value = req.headers.get("x-organization-id");
  return value && z.string().uuid().safeParse(value).success ? value : null;
}

function ackToken(): string {
  // 6 chars, no ambiguous I/O/0/1. Stored as data, never as auth.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

async function ensureInitialCron(row: NotificationRow): Promise<void> {
  if (row.status !== "scheduled") return;
  const pool = getRequestPool();
  const existing = await pool.query<{ id: string }>(
    `select id from cron_jobs
      where organization_id = $1
        and contact_id = $2
        and job_kind = 'notification_delivery'
        and payload->>'notification_id' = $3
        and payload->>'phase' = 'initial'
        and enabled = true
      limit 1`,
    [row.organization_id, row.contact_id, row.id],
  );
  if (existing.rows[0]) return;
  await scheduleCronJob(pool, row.organization_id, {
    leadId: row.contact_id,
    spec: { kind: "at", at: row.scheduled_at },
    jobKind: "notification_delivery",
    payload: { notification_id: row.id, phase: "initial" },
    staggerWindowMs: 0,
    maxAttempts: 5,
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!authorized(req)) {
    return fail("unauthenticated", "Internal secret missing or invalid.", 401, { requestId });
  }
  const orgId = organizationId(req);
  if (!orgId) {
    return fail("validation_failed", "x-organization-id válido é obrigatório.", 422, { requestId });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", "Campos inválidos.", 422, {
      requestId,
      details: { errors: parsed.error.flatten() },
    });
  }

  const pool = getRequestPool();
  const contact = await pool.query<{ id: string }>(
    `select id from contacts where organization_id = $1 and id = $2 limit 1`,
    [orgId, parsed.data.contact_id],
  );
  if (!contact.rows[0]) return fail("not_found", "Contato não encontrado.", 404, { requestId });

  const scheduledAt = new Date(parsed.data.scheduled_at);
  const escalationAt = new Date(
    scheduledAt.getTime() + parsed.data.escalation_after_minutes * 60_000,
  );

  const existing = await pool.query<NotificationRow>(
    `select id, organization_id, contact_id, idempotency_key, body, ack_token,
            status, scheduled_at, escalation_at
       from notification_requests
      where organization_id = $1 and idempotency_key = $2
      limit 1`,
    [orgId, parsed.data.idempotency_key],
  );

  let row = existing.rows[0] ?? null;
  if (row) {
    const same =
      row.contact_id === parsed.data.contact_id &&
      row.body === parsed.data.body &&
      row.scheduled_at.getTime() === scheduledAt.getTime() &&
      row.escalation_at.getTime() === escalationAt.getTime();
    if (!same) {
      return fail(
        "idempotency_conflict",
        "A idempotency_key já existe com parâmetros diferentes.",
        409,
        { requestId },
      );
    }
  } else {
    for (let attempt = 0; attempt < 5 && !row; attempt += 1) {
      try {
        const inserted = await pool.query<NotificationRow>(
          `insert into notification_requests
             (organization_id, contact_id, idempotency_key, body, ack_token,
              status, scheduled_at, escalation_at)
           values ($1,$2,$3,$4,$5,'scheduled',$6,$7)
           on conflict (organization_id, idempotency_key) do nothing
           returning id, organization_id, contact_id, idempotency_key, body, ack_token,
                     status, scheduled_at, escalation_at`,
          [
            orgId,
            parsed.data.contact_id,
            parsed.data.idempotency_key,
            parsed.data.body,
            ackToken(),
            scheduledAt,
            escalationAt,
          ],
        );
        row = inserted.rows[0] ?? null;
      } catch (error) {
        // ack_token collision is vanishingly rare, but the unique constraint is
        // intentional and retries must not turn it into an outage.
        if (!(typeof error === "object" && error !== null && "code" in error && error.code === "23505")) {
          throw error;
        }
      }
    }
    if (!row) {
      const raced = await pool.query<NotificationRow>(
        `select id, organization_id, contact_id, idempotency_key, body, ack_token,
                status, scheduled_at, escalation_at
           from notification_requests
          where organization_id = $1 and idempotency_key = $2 limit 1`,
        [orgId, parsed.data.idempotency_key],
      );
      row = raced.rows[0] ?? null;
    }
  }

  if (!row) return fail("internal_error", "Não foi possível reservar o lembrete.", 500, { requestId });
  await ensureInitialCron(row);

  return ok(
    {
      notification_id: row.id,
      status: row.status,
      scheduled_at: row.scheduled_at.toISOString(),
      escalation_at: row.escalation_at.toISOString(),
      acknowledgement: `CONFIRMAR ${row.ack_token}`,
    },
    { requestId },
  );
}
