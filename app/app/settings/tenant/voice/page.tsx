import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { parseStoredVoiceTenantConfig } from "@/lib/voice/config";
import { getActiveVoiceProfile, parseVoiceProfileHistory } from "@/lib/voice/engine/voice-profile-version";

import { VoiceSettingsForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function VoiceSettingsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) redirect("/403");

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();
  const settings = (data?.settings as Record<string, unknown> | null) ?? {};
  const voice = parseStoredVoiceTenantConfig(settings.voice);
  const voiceProfileHistory = parseVoiceProfileHistory(settings.voiceProfileHistory);
  const voiceProfile = getActiveVoiceProfile(voiceProfileHistory);
  const activeVoiceProfileVersion = voiceProfileHistory.activeVersion;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Configuração de voz</h1>
        <p className="text-sm text-muted-foreground">
          Defina quando a IA atende, horários, limites, transferência humana, gravação e transcrição.
        </p>
      </header>
      <VoiceSettingsForm
        initial={voice}
        initialVoiceProfile={voiceProfile}
        initialVoiceProfileVersion={activeVoiceProfileVersion}
      />
    </div>
  );
}
