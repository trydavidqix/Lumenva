import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type pg from "pg";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { env } from "@/lib/env";
import { normalizePatterMetrics } from "@/lib/voice/patter/telemetry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const E164 = /^\+[1-9]\d{6,14}$/;
const stateSchema = z.enum(["connecting", "active", "held", "transferring", "completed", "failed", "canceled"]);
const bodySchema = z
  .object({
    voice_call_id: z.string().uuid(),
    // Telnyx path (legacy, purchased technical number): identifies the
    // worker/tenant boundary by itself.
    technical_phone_e164: z.string().regex(E164).optional(),
    // SIP/BYOC path (Fase 2 do plano open-source): identifies the boundary
    // by a verified customer connection, not a purchased number — so it
    // needs the customer's own number too, to bind direction the same way
    // the Telnyx path does.
    connection_id: z.string().min(1).max(256).optional(),
    phone_e164: z.string().regex(E164).optional(),
    state: stateSchema,
    provider_event_id: z.string().min(1).max(256),
    provider_call_id: z.string().min(1).max(256).optional(),
    occurred_at: z.string().datetime().optional(),
    metrics: z.object({
      carrierMs: z.number().nonnegative().optional(),
      sttMs: z.number().nonnegative().optional(),
      agentMs: z.number().nonnegative().optional(),
      ttsMs: z.number().nonnegative().optional(),
      e2eMs: z.number().nonnegative().optional(),
      interruptionMs: z.number().nonnegative().optional(),
      carrierCostCents: z.number().nonnegative().optional(),
      sttCostCents: z.number().nonnegative().optional(),
      ttsCostCents: z.number().nonnegative().optional(),
    }).optional(),
  })
  .superRefine((data, ctx) => {
    const hasTelnyx = Boolean(data.technical_phone_e164);
    const hasSip = Boolean(data.connection_id);
    if (hasTelnyx === hasSip) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "exactly one of technical_phone_e164 or connection_id is required",
      });
    }
    if (hasSip && !data.phone_e164) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "phone_e164 is required when connection_id is used" });
    }
  });

interface BoundCall {
  organization_id: string;
}

/** Legacy path: a purchased Telnyx number identifies the worker/tenant boundary by itself. */
async function bindByTechnicalNumber(
  db: pg.Pool,
  voiceCallId: string,
  technicalPhoneE164: string,
): Promise<BoundCall | undefined> {
  const { rows } = await db.query<BoundCall>(
    `select vc.organization_id
       from voice_calls vc
       join voice_phone_numbers vpn
         on vpn.organization_id = vc.organization_id
        and vpn.provider = 'telnyx'
        and vpn.phone_e164 = $2
        and vpn.enabled = true
      where vc.id = $1
        and (
          (vc.direction = 'inbound' and vc.called_number = $2)
          or
          (vc.direction = 'outbound' and vc.caller_number = $2)
        )
      limit 1`,
    [voiceCallId, technicalPhoneE164],
  );
  return rows[0];
}

/**
 * SIP/BYOC path (Fase 2 do plano open-source): no purchased number exists —
 * the boundary is a verified customer connection plus the customer's own
 * number, mirroring the same direction-based binding the Telnyx path uses.
 * An unverified/disabled/unknown connection never matches, same tenant
 * isolation invariant as `lib/voice/sip/asterisk-adapter.ts`.
 */
async function bindByVerifiedConnection(
  db: pg.Pool,
  voiceCallId: string,
  connectionId: string,
  phoneE164: string,
): Promise<BoundCall | undefined> {
  const { rows } = await db.query<BoundCall>(
    `select vc.organization_id
       from voice_calls vc
       join voice_sip_connections vsc
         on vsc.organization_id = vc.organization_id
        and vsc.gateway = 'asterisk'
        and vsc.external_connection_id = $2
        and vsc.verified = true
        and vsc.enabled = true
       join voice_phone_numbers vpn
         on vpn.connection_id = vsc.id
        and vpn.phone_e164 = $3
        and vpn.enabled = true
      where vc.id = $1
        and (
          (vc.direction = 'inbound' and vc.called_number = $3)
          or
          (vc.direction = 'outbound' and vc.caller_number = $3)
        )
      limit 1`,
    [voiceCallId, connectionId, phoneE164],
  );
  return rows[0];
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function authorize(req: NextRequest): boolean {
  const expected = env.INTERNAL_SECRET;
  if (!expected) return false;
  return timingSafeEq(req.headers.get("x-internal-secret") ?? "", expected);
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!authorize(req)) return fail("unauthenticated", "Internal secret missing or invalid.", 401, { requestId });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Evento de voz inválido.", 422, { requestId });

  const db = getRequestPool();
  // Same vocabulary voice_calls_provider_check / voice_call_events_provider_check enforce
  // ('telnyx' | 'asterisk') — never a made-up literal like the platform/product name.
  const provider = parsed.data.technical_phone_e164 ? "telnyx" : "asterisk";
  const call = parsed.data.technical_phone_e164
    ? await bindByTechnicalNumber(db, parsed.data.voice_call_id, parsed.data.technical_phone_e164)
    : await bindByVerifiedConnection(db, parsed.data.voice_call_id, parsed.data.connection_id!, parsed.data.phone_e164!);
  if (!call) return fail("voice_call_not_found", "Chamada não encontrada ou fora do worker autorizado.", 404, { requestId });

  const metrics = parsed.data.metrics ? normalizePatterMetrics(parsed.data.metrics) : undefined;
  const occurredAt = parsed.data.occurred_at ?? new Date().toISOString();
  const terminal = ["completed", "failed", "canceled"].includes(parsed.data.state);
  const updated = await db.query<{ id: string }>(
    `update voice_calls
        set state = $3,
            provider_call_id = coalesce(provider_call_id, $6),
            started_at = case when $3 = 'active' then coalesce(started_at, $4::timestamptz) else started_at end,
            answered_at = case when $3 = 'active' then coalesce(answered_at, $4::timestamptz) else answered_at end,
            ended_at = case when $5::boolean then coalesce(ended_at, $4::timestamptz) else ended_at end,
            updated_at = now()
      where id = $1
        and organization_id = $2
        and (state not in ('completed','failed','canceled') or state = $3)
        and (provider_call_id is null or $6::text is null or provider_call_id = $6::text)
        and not exists (
          select 1
            from voice_call_events vce
           where vce.organization_id = $2
             and vce.voice_call_id = $1
             and vce.provider = $8
             and vce.provider_event_id = $7
        )
      returning id`,
    [
      parsed.data.voice_call_id,
      call.organization_id,
      parsed.data.state,
      occurredAt,
      terminal,
      parsed.data.provider_call_id ?? null,
      parsed.data.provider_event_id,
      provider,
    ],
  );
  if (!updated.rows[0]?.id) {
    const { rows: duplicate } = await db.query<{ id: string }>(
      `select id
         from voice_call_events
        where organization_id = $1
          and voice_call_id = $2
          and provider = $4
          and provider_event_id = $3
        limit 1`,
      [call.organization_id, parsed.data.voice_call_id, parsed.data.provider_event_id, provider],
    );
    if (duplicate[0]?.id) return ok({ recorded: true }, { requestId });
    return fail("voice_event_conflict", "Evento de voz conflita com o estado terminal ou provider call id existente.", 409, { requestId });
  }

  await db.query(
    `insert into voice_call_events
       (organization_id, voice_call_id, provider, provider_event_id, event_type, attributes, occurred_at)
     values ($1,$2,$7,$3,$4,$5::jsonb,$6::timestamptz)
     on conflict (organization_id, provider, provider_event_id) do nothing`,
    [
      call.organization_id,
      parsed.data.voice_call_id,
      parsed.data.provider_event_id,
      `voice.${parsed.data.state}`,
      JSON.stringify(metrics ?? {}),
      occurredAt,
      provider,
    ],
  );

  return ok({ recorded: true }, { requestId });
}
