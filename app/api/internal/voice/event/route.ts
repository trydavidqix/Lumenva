import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { env } from "@/lib/env";
import { normalizePatterMetrics } from "@/lib/voice/patter/telemetry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stateSchema = z.enum(["connecting", "active", "held", "transferring", "completed", "failed", "canceled"]);
const bodySchema = z.object({
  voice_call_id: z.string().uuid(),
  state: stateSchema,
  provider_event_id: z.string().min(1).max(256),
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
});

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
  const { rows } = await db.query<{ organization_id: string }>(
    `select organization_id from voice_calls where id = $1 limit 1`,
    [parsed.data.voice_call_id],
  );
  const call = rows[0];
  if (!call) return fail("voice_call_not_found", "Chamada não encontrada.", 404, { requestId });

  const metrics = parsed.data.metrics ? normalizePatterMetrics(parsed.data.metrics) : undefined;
  const occurredAt = parsed.data.occurred_at ?? new Date().toISOString();
  const terminal = ["completed", "failed", "canceled"].includes(parsed.data.state);
  await db.query(
    `update voice_calls
        set state = $3,
            started_at = case when $3 = 'active' then coalesce(started_at, $4::timestamptz) else started_at end,
            answered_at = case when $3 = 'active' then coalesce(answered_at, $4::timestamptz) else answered_at end,
            ended_at = case when $5::boolean then coalesce(ended_at, $4::timestamptz) else ended_at end,
            updated_at = now()
      where id = $1 and organization_id = $2`,
    [parsed.data.voice_call_id, call.organization_id, parsed.data.state, occurredAt, terminal],
  );
  await db.query(
    `insert into voice_call_events
       (organization_id, voice_call_id, provider, provider_event_id, event_type, payload, occurred_at)
     values ($1,$2,'lumenva',$3,$4,$5::jsonb,$6::timestamptz)
     on conflict (organization_id, provider, provider_event_id) do nothing`,
    [
      call.organization_id,
      parsed.data.voice_call_id,
      parsed.data.provider_event_id,
      `voice.${parsed.data.state}`,
      JSON.stringify(metrics ?? {}),
      occurredAt,
    ],
  );

  return ok({ recorded: true }, { requestId });
}
