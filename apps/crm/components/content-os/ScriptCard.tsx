"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, FileText, PencilSimple } from "@/lib/ui/icons";

export type ScriptStatus = "draft" | "review" | "approved" | "archived";

export interface ContentScript {
  id: string;
  title: string;
  summary?: string;
  channel: string;
  campaign?: string;
  status: ScriptStatus;
  version: number;
  linkedContentCount?: number;
  assetCount?: number;
  updatedAt?: string;
}

const STATUS_LABEL: Record<ScriptStatus, string> = {
  draft: "Rascunho",
  review: "Em revisão",
  approved: "Aprovado",
  archived: "Arquivado",
};

const STATUS_VARIANT: Record<ScriptStatus, "neutral" | "warning" | "success"> = {
  draft: "neutral",
  review: "warning",
  approved: "success",
  archived: "neutral",
};

export function ScriptCard({
  script,
  onCopy,
  onEdit,
}: {
  script: ContentScript;
  onCopy?: (script: ContentScript) => void;
  onEdit?: (script: ContentScript) => void;
}) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-md bg-accent-soft p-2 text-accent" aria-hidden="true">
            <FileText size={18} weight="duotone" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-medium text-text">{script.title}</h2>
            <p className="mt-1 text-xs text-text-muted">Versão {script.version}</p>
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[script.status]}>{STATUS_LABEL[script.status]}</Badge>
      </div>

      {script.summary ? <p className="line-clamp-2 text-sm text-text-muted">{script.summary}</p> : null}

      <dl className="grid grid-cols-2 gap-3 border-y border-border py-3 text-xs">
        <div>
          <dt className="text-text-muted">Canal</dt>
          <dd className="mt-1 font-medium text-text">{script.channel}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Campanha</dt>
          <dd className="mt-1 truncate font-medium text-text">{script.campaign ?? "Sem campanha"}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Conteúdos ligados</dt>
          <dd className="mt-1 font-medium text-text">{script.linkedContentCount ?? 0}</dd>
        </div>
        <div>
          <dt className="text-text-muted">Assets</dt>
          <dd className="mt-1 font-medium text-text">{script.assetCount ?? 0}</dd>
        </div>
      </dl>

      <div className="mt-auto flex gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => onCopy?.(script)}>
          <Copy size={14} /> Copiar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onEdit?.(script)}>
          <PencilSimple size={14} /> Editar
        </Button>
      </div>
    </article>
  );
}

