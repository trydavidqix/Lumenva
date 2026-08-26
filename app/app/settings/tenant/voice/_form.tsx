"use client";

import { useState } from "react";

import type { VoiceTenantConfig } from "@/lib/voice/config";

const DAYS: Array<{ key: keyof VoiceTenantConfig["businessHours"]; label: string }> = [
  { key: "monday", label: "Segunda" },
  { key: "tuesday", label: "Terça" },
  { key: "wednesday", label: "Quarta" },
  { key: "thursday", label: "Quinta" },
  { key: "friday", label: "Sexta" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

export function VoiceSettingsForm({ initial }: { initial: VoiceTenantConfig }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

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
