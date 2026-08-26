import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  VoiceTenantConfigSchema,
  mergeVoiceTenantConfig,
  parseStoredVoiceTenantConfig,
} from "@/lib/voice/config";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "voice_config" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });

  const settings = (data?.settings as Record<string, unknown> | null) ?? {};
  return ok(parseStoredVoiceTenantConfig(settings.voice), { requestId });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "voice_config" });
  if (!authz.ok) return authz.response;
  const { user, org: activeOrg } = authz;

  let patch;
  try {
    patch = VoiceTenantConfigSchema.partial().parse(await req.json());
  } catch (error) {
    return fail("validation_error", error instanceof Error ? error.message : "Configuração de voz inválida.", 400, { requestId });
  }

  const supabase = createAdminClient();
  const { data, error: readError } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();
  if (readError) return fail("internal_error", readError.message, 500, { requestId });

  const currentSettings = (data?.settings as Record<string, unknown> | null) ?? {};
  const currentVoice = parseStoredVoiceTenantConfig(currentSettings.voice);
  const voice = mergeVoiceTenantConfig(currentVoice, patch);
  const nextSettings = { ...currentSettings, voice };

  const { error: updateError } = await supabase
    .from("organizations")
    .update({ settings: nextSettings })
    .eq("id", activeOrg.orgId);
  if (updateError) return fail("internal_error", updateError.message, 500, { requestId });

  void audit({
    action: "org.updated",
    actorUserId: user.id,
    organizationId: activeOrg.orgId,
    resourceType: "organization",
    resourceId: activeOrg.orgId,
    requestId,
    metadata: {
      scope: "voice",
      mode: voice.mode,
      recording_enabled: voice.recording.enabled,
      transcription_enabled: voice.transcription.enabled,
    },
  });

  return ok(voice, { requestId });
}
