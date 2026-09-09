"use client";

import { ArrowSquareOut, Check, X } from "@/lib/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty/EmptyState";

export type RadarSignal = { id: string; title: string; rationale?: string | null; priority?: number | null; status?: string | null; source_url?: string | null; created_at?: string | null };

function priorityLabel(priority: number) { return priority >= 80 ? "Alta" : priority >= 50 ? "Média" : "Baixa"; }

export function RadarFeed({ signals, loading = false, onDecision }: { signals: RadarSignal[]; loading?: boolean; onDecision?: (id: string, status: "accepted" | "rejected") => void }) {
  if (loading) return <div className="grid gap-4 md:grid-cols-2">{[1, 2].map((item) => <Card key={item}><CardContent className="h-44 animate-pulse p-6" /></Card>)}</div>;
  if (!signals.length) return <Card><EmptyState icon={Check} headline="Radar em dia" subcopy="Nenhum sinal novo aguarda decisão." /></Card>;
  return <div className="grid gap-4 md:grid-cols-2">{signals.map((signal) => { const priority = signal.priority ?? 0; return <Card key={signal.id} className="flex h-full flex-col"><CardHeader className="gap-3 pb-3"><div className="flex items-start justify-between gap-3"><CardTitle className="leading-snug">{signal.title}</CardTitle><Badge variant={priority >= 80 ? "error" : priority >= 50 ? "warning" : "neutral"}>{priorityLabel(priority)}</Badge></div><p className="text-xs text-muted-foreground">{signal.created_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(signal.created_at)) : "Sinal recente"}</p></CardHeader><CardContent className="flex-1 pt-0"><p className="text-sm leading-relaxed text-muted-foreground">{signal.rationale || "Este sinal pode render uma pauta relevante."}</p></CardContent><CardFooter className="flex flex-wrap gap-2 border-t border-border pt-4"><Button size="sm" onClick={() => onDecision?.(signal.id, "accepted")}><Check size={15} aria-hidden /> Criar oportunidade</Button><Button size="sm" variant="ghost" onClick={() => onDecision?.(signal.id, "rejected")}><X size={15} aria-hidden /> Ignorar</Button>{signal.source_url ? <Button asChild size="sm" variant="link" className="ml-auto"><a href={signal.source_url} target="_blank" rel="noreferrer">Abrir origem <ArrowSquareOut size={14} aria-hidden /></a></Button> : null}</CardFooter></Card>; })}</div>;
}
