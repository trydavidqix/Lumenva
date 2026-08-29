"use client";

import { useState } from "react";

import type { VoiceProfile, VoiceProfileMode, VoiceProfileProvider } from "@/lib/voice/engine/contracts";
import type { VoiceTenantConfig } from "@/lib/voice/config";

const VOICE_PROFILE_DEFAULT: VoiceProfile = {
  mode: "preset",
  locale: "pt-PT",
  gender: "female",
  voiceId: "",
  provider: "piper",
  tone: "",
  style: "",
  speed: 1,
};

const DAYS: Array<{ key: keyof VoiceTenantConfig["businessHours"]; label: string }> = [
  { key: "monday", label: "Segunda" },
  { key: "tuesday", label: "Terça" },
  { key: "wednesday", label: "Quarta" },
  { key: "thursday", label: "Quinta" },
  { key: "friday", label: "Sexta" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

export function VoiceSettingsForm({
  initial,
  initialVoiceProfile,
  initialVoiceProfileVersion,
}: {
  initial: VoiceTenantConfig;
  initialVoiceProfile: VoiceProfile | null;
  initialVoiceProfileVersion: number | null;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [voiceProfileDraft, setVoiceProfileDraft] = useState<VoiceProfile>(initialVoiceProfile ?? VOICE_PROFILE_DEFAULT);
  const [activeVoiceProfile, setActiveVoiceProfile] = useState<VoiceProfile | null>(initialVoiceProfile);
  const [activeVoiceProfileVersion, setActiveVoiceProfileVersion] = useState<number | null>(initialVoiceProfileVersion);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);

  async function publishVoiceProfile() {
    setPublishing(true);
    setPublishStatus(null);
    try {
      const response = await fetch("/api/v1/voice/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(voiceProfileDraft),
      });
      const body = (await response.json()) as { data?: { voiceProfile: VoiceProfile; version: number }; error?: { message: string } };
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Não conseguimos publicar a voz.");
      setActiveVoiceProfile(body.data.voiceProfile);
      setActiveVoiceProfileVersion(body.data.version);
      setPublishStatus(`Publicado — versão ${body.data.version}.`);
    } catch (error) {
      setPublishStatus(error instanceof Error ? error.message : "Não conseguimos publicar a voz.");
    } finally {
      setPublishing(false);
    }
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/v1/voice/config", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!response.ok) throw new Error("Não conseguimos salvar a configuração de voz.");
      setStatus("Salvo.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não conseguimos salvar a configuração de voz.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-lg border bg-card p-5 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Modo de atendimento</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2"
            value={value.mode}
            onChange={(event) => setValue((current) => ({ ...current, mode: event.target.value as VoiceTenantConfig["mode"] }))}
          >
            <option value="always_ai">IA sempre</option>
            <option value="no_answer">IA quando ninguém atender</option>
            <option value="after_hours">IA fora do horário</option>
            <option value="overflow">IA em overflow / ocupado</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Idioma</span>
          <input className="w-full rounded-md border bg-background px-3 py-2" value={value.locale} onChange={(e) => setValue((c) => ({ ...c, locale: e.target.value }))} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Fuso horário</span>
          <input className="w-full rounded-md border bg-background px-3 py-2" value={value.timezone} onChange={(e) => setValue((c) => ({ ...c, timezone: e.target.value }))} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Duração máxima da chamada (segundos)</span>
          <input type="number" min={60} max={14400} className="w-full rounded-md border bg-background px-3 py-2" value={value.maxCallDurationSeconds} onChange={(e) => setValue((c) => ({ ...c, maxCallDurationSeconds: Number(e.target.value) }))} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Silêncio máximo (segundos)</span>
          <input type="number" min={3} max={300} className="w-full rounded-md border bg-background px-3 py-2" value={value.silenceTimeoutSeconds} onChange={(e) => setValue((c) => ({ ...c, silenceTimeoutSeconds: Number(e.target.value) }))} />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Destinos humanos</span>
          <textarea
            className="min-h-20 w-full rounded-md border bg-background px-3 py-2"
            value={value.humanTransferDestinations.join("\n")}
            onChange={(e) => setValue((c) => ({ ...c, humanTransferDestinations: e.target.value.split("\n").map((v) => v.trim()).filter(Boolean) }))}
            placeholder="Um destino por linha"
          />
        </label>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-base font-semibold">Horário comercial</h2>
        <div className="mt-4 space-y-3">
          {DAYS.map(({ key, label }) => {
            const day = value.businessHours[key];
            return (
              <div key={key} className="grid items-center gap-3 md:grid-cols-[120px_100px_1fr_1fr]">
                <span className="text-sm font-medium">{label}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={day.enabled} onChange={(e) => setValue((c) => ({ ...c, businessHours: { ...c.businessHours, [key]: { ...day, enabled: e.target.checked } } }))} />
                  Ativo
                </label>
                <input type="time" className="rounded-md border bg-background px-3 py-2 text-sm" value={day.start} disabled={!day.enabled} onChange={(e) => setValue((c) => ({ ...c, businessHours: { ...c.businessHours, [key]: { ...day, start: e.target.value } } }))} />
                <input type="time" className="rounded-md border bg-background px-3 py-2 text-sm" value={day.end} disabled={!day.enabled} onChange={(e) => setValue((c) => ({ ...c, businessHours: { ...c.businessHours, [key]: { ...day, end: e.target.value } } }))} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <div>
          <h2 className="text-base font-semibold">Voz do agente</h2>
          <p className="text-sm text-muted-foreground">
            {activeVoiceProfile
              ? `Ativa (versão ${activeVoiceProfileVersion}): ${activeVoiceProfile.provider} · ${activeVoiceProfile.locale} · ${activeVoiceProfile.gender}${activeVoiceProfile.voiceId ? ` · ${activeVoiceProfile.voiceId}` : ""}${activeVoiceProfile.tone ? ` · ${activeVoiceProfile.tone}` : ""}${activeVoiceProfile.style ? ` · ${activeVoiceProfile.style}` : ""}${activeVoiceProfile.speed ? ` · ${activeVoiceProfile.speed}x` : ""}`
              : "Nenhuma voz publicada ainda — usando o padrão do adapter atual."}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Idioma</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              value={voiceProfileDraft.locale}
              onChange={(e) => setVoiceProfileDraft((c) => ({ ...c, locale: e.target.value }))}
              placeholder="pt-PT"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Género</span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={voiceProfileDraft.gender}
              onChange={(e) => setVoiceProfileDraft((c) => ({ ...c, gender: e.target.value as VoiceProfile["gender"] }))}
            >
              <option value="female">Feminina</option>
              <option value="male">Masculina</option>
              <option value="neutral">Neutra</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Provider</span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={voiceProfileDraft.provider}
              onChange={(e) => setVoiceProfileDraft((c) => ({ ...c, provider: e.target.value as VoiceProfileProvider }))}
            >
              <option value="piper">Piper</option>
              <option value="kokoro">Kokoro</option>
              <option value="openvoice">OpenVoice (clonada)</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Voz específica (voiceId)</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              value={voiceProfileDraft.voiceId}
              onChange={(e) => setVoiceProfileDraft((c) => ({ ...c, voiceId: e.target.value }))}
              placeholder="ex.: pt-pt-ines"
            />
          </label>
          {voiceProfileDraft.provider === "openvoice" && (
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium">ID do perfil clonado</span>
              <input
                className="w-full rounded-md border bg-background px-3 py-2"
                value={voiceProfileDraft.mode === "cloned" ? voiceProfileDraft.cloneProfileId : ""}
                onChange={(e) => {
                  const cloneProfileId = e.target.value;
                  setVoiceProfileDraft((c) => ({ ...c, mode: "cloned" as VoiceProfileMode, provider: "openvoice", cloneProfileId }));
                }}
                placeholder="clone-123 — exige consentimento verificado antes de existir"
              />
            </label>
          )}
          <label className="space-y-1 text-sm">
            <span className="font-medium">Tom</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              value={voiceProfileDraft.tone ?? ""}
              onChange={(e) => setVoiceProfileDraft((c) => ({ ...c, tone: e.target.value || undefined }))}
              placeholder="ex.: caloroso, profissional"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Estilo</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              value={voiceProfileDraft.style ?? ""}
              onChange={(e) => setVoiceProfileDraft((c) => ({ ...c, style: e.target.value || undefined }))}
              placeholder="ex.: conversacional"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Velocidade</span>
            <input
              type="number"
              min={0.5}
              max={2}
              step={0.05}
              className="w-full rounded-md border bg-background px-3 py-2"
              value={voiceProfileDraft.speed ?? 1}
              onChange={(e) => setVoiceProfileDraft((c) => ({ ...c, speed: Number(e.target.value) }))}
            />
            <span className="text-xs text-muted-foreground">Entre 0,5 e 2,0.</span>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={publishing || !voiceProfileDraft.voiceId.trim()}
            onClick={publishVoiceProfile}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {publishing ? "Publicando…" : "Publicar nova versão"}
          </button>
          {publishStatus && (
            <span className="text-sm text-muted-foreground" role="status">
              {publishStatus}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Publicar cria uma versão nova e imutável — não sobrescreve a versão ativa anterior. Prévia de áudio, upload de
          gravação para clonagem e teste da voz clonada ainda não estão nesta tela.
        </p>
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-5 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Gravação</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.recording.enabled} onChange={(e) => setValue((c) => ({ ...c, recording: { ...c.recording, enabled: e.target.checked } }))} />
            Permitir gravação
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.recording.requireConsentDisclosure} onChange={(e) => setValue((c) => ({ ...c, recording: { ...c.recording, requireConsentDisclosure: e.target.checked } }))} />
            Exigir aviso de consentimento
          </label>
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Transcrição</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.transcription.enabled} onChange={(e) => setValue((c) => ({ ...c, transcription: { ...c.transcription, enabled: e.target.checked } }))} />
            Permitir transcrição
          </label>
          <label className="space-y-1 text-sm">
            <span>Retenção (dias)</span>
            <input type="number" min={0} max={3650} className="w-full rounded-md border bg-background px-3 py-2" value={value.transcription.retainDays} onChange={(e) => setValue((c) => ({ ...c, transcription: { ...c.transcription, retainDays: Number(e.target.value) } }))} />
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="button" disabled={saving} onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {saving ? "Salvando…" : "Salvar configuração"}
        </button>
        {status && <span className="text-sm text-muted-foreground" role="status">{status}</span>}
      </div>
    </div>
  );
}
