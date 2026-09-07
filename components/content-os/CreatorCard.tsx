"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserCircle } from "@/lib/ui/icons";

export type CreatorStatus = "available" | "assigned" | "inactive";

export interface ContentCreator {
  id: string;
  name: string;
  role?: string;
  speciality?: string;
  channels: string[];
  location?: string;
  audience?: string;
  status: CreatorStatus;
  assignments?: number;
  recentContent?: number;
  performance?: { label: string; value: string };
}

const STATUS_LABEL: Record<CreatorStatus, string> = { available: "Disponível", assigned: "Em trabalho", inactive: "Inativo" };
const STATUS_VARIANT: Record<CreatorStatus, "success" | "warning" | "neutral"> = { available: "success", assigned: "warning", inactive: "neutral" };

export function CreatorCard({ creator, onAssign }: { creator: ContentCreator; onAssign?: (creator: ContentCreator) => void }) {
  return <article className="flex h-full flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-xs">
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="rounded-full bg-accent-soft p-2 text-accent"><UserCircle size={23} weight="duotone" /></span><div className="min-w-0"><h2 className="truncate font-medium text-text">{creator.name}</h2><p className="truncate text-xs text-text-muted">{creator.role ?? "Criador"}{creator.speciality ? ` · ${creator.speciality}` : ""}</p></div></div><Badge variant={STATUS_VARIANT[creator.status]}>{STATUS_LABEL[creator.status]}</Badge></div>
    <div className="flex flex-wrap gap-2">{creator.channels.length ? creator.channels.map((channel) => <Badge key={channel} variant="neutral">{channel}</Badge>) : <span className="text-sm text-text-muted">Canais não definidos</span>}</div>
    <dl className="grid grid-cols-2 gap-3 border-y border-border py-3 text-xs"><div><dt className="text-text-muted">Localização</dt><dd className="mt-1 font-medium text-text">{creator.location ?? "Não informado"}</dd></div><div><dt className="text-text-muted">Público</dt><dd className="mt-1 font-medium text-text">{creator.audience ?? "Não informado"}</dd></div><div><dt className="text-text-muted">Atribuições</dt><dd className="mt-1 font-medium text-text">{creator.assignments ?? 0}</dd></div><div><dt className="text-text-muted">Conteúdos recentes</dt><dd className="mt-1 font-medium text-text">{creator.recentContent ?? 0}</dd></div></dl>
    {creator.performance ? <p className="text-xs text-text-muted">{creator.performance.label}: <span className="font-medium text-text">{creator.performance.value}</span></p> : <p className="text-xs text-text-muted">Performance ainda sem dados medidos.</p>}
    <Button type="button" size="sm" variant="secondary" disabled={creator.status === "inactive"} onClick={() => onAssign?.(creator)}>Atribuir conteúdo</Button>
  </article>;
}

