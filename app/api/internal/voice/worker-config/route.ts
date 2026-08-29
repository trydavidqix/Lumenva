import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { env } from "@/lib/env";
import { parseStoredVoiceTenantConfig } from "@/lib/voice/config";
import { createVoiceOrganizationResolver } from "@/lib/voice/identity/resolve-organization";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ phone_e164: z.string().regex(/^\+[1-9]\d{6,14}$/) });

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const expected = env.INTERNAL_SECRET;
  if (!expected || !timingSafeEq(req.headers.get("x-internal-secret") ?? "", expected)) {
    return fail("unauthenticated", "Internal secret missing or invalid.", 401, { requestId });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Número técnico inválido.", 422, { requestId });

  const db = getRequestPool();
  const organizationId = await createVoiceOrganizationResolver(db).resolve("telnyx", parsed.data.phone_e164);
  if (!organizationId) return fail("voice_number_unowned", "Número técnico não está ativo para um tenant.", 404, { requestId });

  const { rows } = await db.query<{ settings: Record<string, unknown> | null }>(
    `select settings from organizations where id = $1 limit 1`,
    [organizationId],
  );
  const voice = parseStoredVoiceTenantConfig(rows[0]?.settings?.voice);
  return ok({
    locale: voice.locale,
    recording_enabled: voice.recording.enabled,
    recording_requires_disclosure: voice.recording.requireConsentDisclosure,
    transcription_enabled: voice.transcription.enabled,
    max_call_duration_seconds: voice.maxCallDurationSeconds,
    silence_timeout_seconds: voice.silenceTimeoutSeconds,
  }, { requestId });
}
