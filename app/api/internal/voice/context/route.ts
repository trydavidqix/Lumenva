import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { CustomerQuickMemorySchema } from "@/lib/agent-engine/customer-memory/types";
import { env } from "@/lib/env";
import { parseStoredVoiceTenantConfig } from "@/lib/voice/config";
import { createVoiceCallerResolver } from "@/lib/voice/identity/resolve-caller";
import { createVoiceOrganizationResolver } from "@/lib/voice/identity/resolve-organization";
import { createVoiceCallContextService } from "@/lib/voice/runtime/context-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  provider_call_id: z.string().min(1).max(256),
  caller_e164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  called_e164: z.string().regex(/^\+[1-9]\d{6,14}$/),
  direction: z.enum(["inbound", "outbound"]),
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
  const rl = await checkRateLimit("internal_voice_context", 600, 60);
  if (!rl.allowed) return fail("rate_limited", "Muitas resoluções de voz.", 429, { requestId });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Voice context inválido.", 422, { requestId });

  try {
    const db = getRequestPool();
    const orgResolver = createVoiceOrganizationResolver(db);
    const callerResolver = createVoiceCallerResolver(db, {
      async getQuickMemory(organizationId, contactId) {
        const { rows } = await db.query<{ memory: unknown }>(
          `select memory from customer_memory where organization_id = $1 and contact_id = $2 limit 1`,
          [organizationId, contactId],
        );
        const memory = rows[0]?.memory;
        return memory === undefined || memory === null ? null : CustomerQuickMemorySchema.parse(memory);
      },
    });
    const service = createVoiceCallContextService({
      resolveOrganization: (provider, number) => orgResolver.resolve(provider, number),
      resolveCaller: (organizationId, number) => callerResolver.resolve(organizationId, number),
      async persistCall(input) {
        const { rows } = await db.query<{ id: string }>(
          `insert into voice_calls
             (organization_id, contact_id, direction, caller_number, called_number, state, provider, provider_call_id)
           values ($1,$2,$3,$4,$5,'connecting','telnyx',$6)
           on conflict (organization_id, provider, provider_call_id)
             where provider_call_id is not null
           do update set contact_id = excluded.contact_id, updated_at = now()
           returning id`,
          [input.organizationId, input.contactId, input.direction, input.callerE164, input.calledE164, input.providerCallId],
        );
        if (!rows[0]?.id) throw new Error("voice_call_persist_failed");
        return rows[0].id;
      },
      async loadConfig(organizationId) {
        const { rows } = await db.query<{ settings: Record<string, unknown> | null }>(
          `select settings from organizations where id = $1 limit 1`,
          [organizationId],
        );
        const settings = rows[0]?.settings ?? {};
        const voice = parseStoredVoiceTenantConfig(settings.voice);
        return { locale: voice.locale };
      },
    });

    const data = await service.resolve({
      providerCallId: parsed.data.provider_call_id,
      callerE164: parsed.data.caller_e164,
      calledE164: parsed.data.called_e164,
      direction: parsed.data.direction,
    });
    return ok({
      voice_call_id: data.voiceCallId,
      contact_id: data.contactId,
      caller_kind: data.callerKind,
      locale: data.locale,
    }, { requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "voice_context_failed";
    return fail("voice_context_failed", message, 409, { requestId });
  }
}
