"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Sparkle, FloppyDisk, CheckCircle } from "@/lib/ui/icons";

export type ContentDraftStatus = "draft" | "in_review" | "approved" | "scheduled" | "published";

export interface ContentDraft {
  id?: string;
  title: string;
  objective: string;
  channel: string;
  format: string;
  hook: string;
  copy: string;
  assets: string;
  cta: string;
  notes: string;
  status: ContentDraftStatus;
  version: number;
  updatedAt?: string;
}

export const EMPTY_CONTENT_DRAFT: ContentDraft = {
  title: "",
  objective: "",
  channel: "Instagram",
  format: "Post",
  hook: "",
  copy: "",
  assets: "",
  cta: "",
  notes: "",
  status: "draft",
  version: 1,
};

export type ContentEditorProps = {
  initialDraft?: Partial<ContentDraft>;
  onChange?: (draft: ContentDraft) => void;
  onSave?: (draft: ContentDraft) => Promise<void> | void;
  onGenerate?: (kind: "options" | "rewrite" | "variants" | "adapt") => void;
  saving?: boolean;
  validationError?: string | null;
  className?: string;
};

const statusLabel: Record<ContentDraftStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovado",
  scheduled: "Agendado",
  published: "Publicado",
};

function mergeDraft(initial?: Partial<ContentDraft>): ContentDraft {
  return { ...EMPTY_CONTENT_DRAFT, ...initial };
}

export function ContentEditor({
  initialDraft,
  onChange,
  onSave,
  onGenerate,
  saving = false,
  validationError,
  className,
}: ContentEditorProps) {
  const [draft, setDraft] = React.useState(() => mergeDraft(initialDraft));
  const [dirty, setDirty] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  function update<K extends keyof ContentDraft>(field: K, value: ContentDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      onChange?.(next);
      return next;
    });
    setDirty(true);
    setSavedAt(null);
  }

  async function save() {
    await onSave?.(draft);
    setDirty(false);
    setSavedAt(new Date().toISOString());
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Criar conteúdo</h1>
          <p className="mt-1 text-sm text-text-muted">Construa, revise e prepare uma publicação em um único espaço.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted" role="status" aria-live="polite">
            {saving ? "Salvando…" : dirty ? "Alterações não salvas" : savedAt ? "Salvo agora" : "Tudo salvo"}
          </span>
          <Button type="button" variant="secondary" onClick={() => void save()} disabled={saving || !dirty}>
            <FloppyDisk aria-hidden="true" /> Salvar rascunho
          </Button>
        </div>
      </div>

      {validationError ? <p className="rounded-sm border border-error bg-error-bg p-3 text-sm text-error-fg" role="alert">{validationError}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Objetivo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label htmlFor="content-title">Título interno</Label><Input id="content-title" value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="Ex.: Como reduzir o tempo de resposta" /></div>
              <div className="space-y-2"><Label htmlFor="content-objective">O que este conteúdo precisa alcançar?</Label><Textarea id="content-objective" rows={3} value={draft.objective} onChange={(event) => update("objective", event.target.value)} placeholder="Descreva o resultado esperado para a audiência." /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="content-channel">Canal</Label><select id="content-channel" className="flex h-10 w-full rounded-sm border border-border bg-bg px-3 text-sm text-text" value={draft.channel} onChange={(event) => update("channel", event.target.value)}><option>Instagram</option><option>LinkedIn</option><option>Blog</option><option>YouTube</option><option>Newsletter</option></select></div>
                <div className="space-y-2"><Label htmlFor="content-format">Formato</Label><select id="content-format" className="flex h-10 w-full rounded-sm border border-border bg-bg px-3 text-sm text-text" value={draft.format} onChange={(event) => update("format", event.target.value)}><option>Post</option><option>Carrossel</option><option>Vídeo curto</option><option>Artigo</option><option>Email</option></select></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between"><CardTitle>Roteiro e copy</CardTitle><Button type="button" size="sm" variant="secondary" onClick={() => onGenerate?.("options")}><Sparkle aria-hidden="true" /> Gerar opções</Button></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label htmlFor="content-hook">Hook</Label><Textarea id="content-hook" rows={3} value={draft.hook} onChange={(event) => update("hook", event.target.value)} placeholder="A primeira frase que conquista atenção." /></div>
              <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => onGenerate?.("rewrite")}>Reescrever</Button><Button type="button" size="sm" variant="ghost" onClick={() => onGenerate?.("variants")}>Criar variações</Button><Button type="button" size="sm" variant="ghost" onClick={() => onGenerate?.("adapt")}>Adaptar canal</Button></div>
              <div className="space-y-2"><Label htmlFor="content-copy">Roteiro/copy</Label><Textarea id="content-copy" rows={12} value={draft.copy} onChange={(event) => update("copy", event.target.value)} placeholder="Escreva o conteúdo principal…" /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Assets e conversão</CardTitle></CardHeader>
            <CardContent className="space-y-4"><div className="space-y-2"><Label htmlFor="content-assets">Assets</Label><Textarea id="content-assets" rows={3} value={draft.assets} onChange={(event) => update("assets", event.target.value)} placeholder="Descreva ou vincule os assets que o conteúdo precisa." /></div><div className="space-y-2"><Label htmlFor="content-cta">CTA</Label><Input id="content-cta" value={draft.cta} onChange={(event) => update("cta", event.target.value)} placeholder="Ex.: Fale com a nossa equipe" /></div><div className="space-y-2"><Label htmlFor="content-notes">Notas para a equipe</Label><Textarea id="content-notes" rows={3} value={draft.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Contexto, fontes ou observações internas." /></div></CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card><CardHeader><CardTitle>Estado e aprovação</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center justify-between"><span className="text-sm text-text-muted">Estado atual</span><Badge variant={draft.status === "approved" || draft.status === "published" ? "success" : draft.status === "in_review" ? "warning" : "neutral"}>{statusLabel[draft.status]}</Badge></div><div className="flex items-center gap-2 text-xs text-text-muted"><CheckCircle aria-hidden="true" /> Versão {draft.version}{draft.updatedAt ? ` · atualizado ${new Date(draft.updatedAt).toLocaleString("pt-BR")}` : ""}</div><p className="text-sm leading-relaxed text-text-muted">Salve as alterações antes de enviar para revisão. A publicação só fica disponível depois da aprovação.</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Checklist</CardTitle></CardHeader><CardContent><ul className="space-y-3 text-sm">{[["Título definido", Boolean(draft.title.trim())], ["Hook revisado", Boolean(draft.hook.trim())], ["Copy preenchida", Boolean(draft.copy.trim())], ["CTA definido", Boolean(draft.cta.trim())]].map(([label, complete]) => <li key={String(label)} className="flex items-center gap-2"> <span className={cn("h-2 w-2 rounded-full", complete ? "bg-success" : "bg-border-strong")} aria-hidden="true" /> <span className={complete ? "text-text" : "text-text-muted"}>{String(label)}</span></li>)}</ul></CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
