import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { env } from "@/lib/env";
import { createProductAgentVoiceDeliveryAuthorizer } from "@/lib/voice/runtime/delivery-policy";
import { createVoiceProductionKernel } from "@/lib/voice/runtime/kernel-runtime";
import { createVoiceTurnService } from "@/lib/voice/runtime/turn-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  voice_call_id: z.string().uuid(),
  transcript: z.string().trim().min(1).max(8000),
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
  const provided = req.headers.get("x-internal-secret") ?? "";
  return timingSafeEq(provided, expected);
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!authorize(req)) return fail("unauthenticated", "Internal secret missing or invalid.", 401, { requestId });
  const rl = await checkRateLimit("internal_voice_turn", 1200, 60);
  if (!rl.allowed) return fail("rate_limited", "Muitos turnos de voz.", 429, { requestId });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Turno de voz inválido.", 422, { requestId });

  try {
    const db = getRequestPool();
    const { rows } = await db.query<{ organization_id: string; contact_id: string | null }>(
      `select organization_id, contact_id
         from voice_calls
        where id = $1 and state not in ('completed','failed','canceled')
        limit 1`,
      [parsed.data.voice_call_id],
    );
    const call = rows[0];
    if (!call) return fail("voice_call_not_active", "Chamada não encontrada ou encerrada.", 409, { requestId });

    const service = createVoiceTurnService({
      kernel: createVoiceProductionKernel(db),
      authorizeDelivery: createProductAgentVoiceDeliveryAuthorizer(),
    });
    const result = await service.run({
      organizationId: call.organization_id,
      contactId: call.contact_id,
      voiceCallId: parsed.data.voice_call_id,
      transcript: parsed.data.transcript,
    });
    return ok(result, { requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "voice_turn_failed";
    return fail("voice_turn_failed", message, 500, { requestId });
  }
}
