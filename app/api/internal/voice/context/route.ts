import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type pg from "pg";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { CustomerQuickMemorySchema } from "@/lib/agent-engine/customer-memory/types";
import { env } from "@/lib/env";
import { parseStoredVoiceTenantConfig } from "@/lib/voice/config";
import { createVoiceCallerResolver, type VoiceCallerResolution } from "@/lib/voice/identity/resolve-caller";
import { createVoiceOrganizationResolver } from "@/lib/voice/identity/resolve-organization";
import { createVoiceCallContextService } from "@/lib/voice/runtime/context-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const E164 = /^\+[1-9]\d{6,14}$/;
const bodySchema = z
  .object({
    provider_call_id: z.string().min(1).max(256),
    caller_e164: z.string().regex(E164),
    called_e164: z.string().regex(E164),
    direction: z.enum(["inbound", "outbound"]),
    // SIP/BYOC path (Fase 3): a verified customer connection replaces the
    // purchased-technical-number identity Telnyx used. Optional and
    // mutually exclusive with the (implicit) Telnyx path below.
    connection_id: z.string().min(1).max(256).optional(),
  })
  .refine((data) => !data.connection_id || data.connection_id.trim().length > 0, {
    message: "connection_id, when present, must not be blank",
  });

interface ContextResult {
  voiceCallId: string;
  contactId: string | null;
  callerKind: VoiceCallerResolution["kind"];
  locale: string;
}

/** Shared by both paths — locale/config lookup has never been provider-specific. */
async function loadVoiceTenantConfig(db: pg.Pool, organizationId: string): Promise<{ locale: string }> {
  const { rows } = await db.query<{ settings: Record<string, unknown> | null }>(
    `select settings from organizations where id = $1 limit 1`,
    [organizationId],
  );
  const settings = rows[0]?.settings ?? {};
  const voice = parseStoredVoiceTenantConfig(settings.voice);
  return { locale: voice.locale };
}

/** Legacy path: a purchased Telnyx number identifies the tenant by itself, via the shared `createVoiceCallContextService`. */
async function resolveTelnyxContext(
  db: pg.Pool,
  callerResolver: ReturnType<typeof createVoiceCallerResolver>,
  input: { providerCallId: string; callerE164: string; calledE164: string; direction: "inbound" | "outbound" },
): Promise<ContextResult> {
  const orgResolver = createVoiceOrganizationResolver(db);
  const service = createVoiceCallContextService({
    resolveOrganization: (provider, number) => orgResolver.resolve(provider, number),
    resolveCaller: (organizationId, number) => callerResolver.resolve(organizationId, number),
    async persistCall(persistInput) {
      const { rows } = await db.query<{ id: string }>(
        `insert into voice_calls
           (organization_id, contact_id, direction, caller_number, called_number, state, provider, provider_call_id)
         values ($1,$2,$3,$4,$5,'connecting','telnyx',$6)
         on conflict (organization_id, provider, provider_call_id)
           where provider_call_id is not null
         do update set contact_id = excluded.contact_id, updated_at = now()
         returning id`,
        [
          persistInput.organizationId,
          persistInput.contactId,
          persistInput.direction,
          persistInput.callerE164,
          persistInput.calledE164,
          persistInput.providerCallId,
        ],
      );
      if (!rows[0]?.id) throw new Error("voice_call_persist_failed");
      return rows[0].id;
    },
    loadConfig: (organizationId) => loadVoiceTenantConfig(db, organizationId),
  });
  return service.resolve({
    providerCallId: input.providerCallId,
    callerE164: input.callerE164,
    calledE164: input.calledE164,
    direction: input.direction,
  });
}

/**
 * SIP/BYOC path (Fase 3 do plano open-source): no purchased number exists —
 * the boundary is a verified customer connection, mirroring
 * `lib/voice/runtime/context-service.ts`'s Telnyx orchestration (resolve
 * organization -> resolve caller -> persist call -> load config) but through
 * `resolveByConnection` instead of `resolve`, and persisting
 * `provider = 'asterisk'`.
 */
async function resolveSipContext(
  db: pg.Pool,
  callerResolver: ReturnType<typeof createVoiceCallerResolver>,
  input: { providerCallId: string; connectionId: string; callerE164: string; calledE164: string; direction: "inbound" | "outbound" },
): Promise<ContextResult> {
  const orgResolver = createVoiceOrganizationResolver(db);
  // Same rule as the Telnyx path: the platform-registered number is the
  // called number for inbound, the caller number for outbound.
  const technicalE164 = input.direction === "inbound" ? input.calledE164 : input.callerE164;
  const customerE164 = input.direction === "inbound" ? input.callerE164 : input.calledE164;

  const organizationId = await orgResolver.resolveByConnection("asterisk", input.connectionId, technicalE164);
  if (organizationId === null) throw new Error("[voice] SIP connection/number is not owned by a verified tenant");

  const caller = await callerResolver.resolve(organizationId, customerE164);

  const { rows } = await db.query<{ id: string }>(
    `insert into voice_calls
       (organization_id, contact_id, direction, caller_number, called_number, state, provider, provider_call_id)
     values ($1,$2,$3,$4,$5,'connecting','asterisk',$6)
     on conflict (organization_id, provider, provider_call_id)
       where provider_call_id is not null
     do update set contact_id = excluded.contact_id, updated_at = now()
     returning id`,
    [organizationId, caller.contactId, input.direction, input.callerE164, input.calledE164, input.providerCallId],
  );
  if (!rows[0]?.id) throw new Error("voice_call_persist_failed");

  const config = await loadVoiceTenantConfig(db, organizationId);
  return { voiceCallId: rows[0].id, contactId: caller.contactId, callerKind: caller.kind, locale: config.locale };
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

    const data: ContextResult = parsed.data.connection_id
      ? await resolveSipContext(db, callerResolver, {
          providerCallId: parsed.data.provider_call_id,
          connectionId: parsed.data.connection_id,
          callerE164: parsed.data.caller_e164,
          calledE164: parsed.data.called_e164,
          direction: parsed.data.direction,
        })
      : await resolveTelnyxContext(db, callerResolver, {
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
    // Provider/DB errors can contain credentials, SQL fragments, or personal
    // data. Only expose the deliberately safe, user-actionable Voice errors.
    const rawMessage = error instanceof Error ? error.message : "";
    const message = rawMessage.startsWith("[voice]")
      ? rawMessage
      : "Não foi possível resolver o contexto de voz.";
    return fail("voice_context_failed", message, 409, { requestId });
  }
}
