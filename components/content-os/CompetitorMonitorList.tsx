"use client";

import Link from "next/link";
import { ArrowSquareOut, Buildings, Clock, Warning } from "@/lib/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty/EmptyState";

export type CompetitorMonitor = { id: string; name: string; website_url?: string | null; status?: string | null; monitored_pages?: number; last_checked_at?: string | null; last_change?: string | null };

const statusLabel: Record<string, string> = { active: "Saudável", pending: "Aguardando", failed: "Falhou", disabled: "Desativado" };

export function CompetitorMonitorList({ monitors, loading = false }: { monitors: CompetitorMonitor[]; loading?: boolean }) {
  if (loading) return <div className="space-y-3">{[1, 2, 3].map((item) => <Card key={item}><CardContent className="h-20 animate-pulse p-5" /></Card>)}</div>;
  if (!monitors.length) return <Card><EmptyState icon={Buildings} headline="Nenhum concorrente monitorado" subcopy="Adicione concorrentes para acompanhar mudanças relevantes." primary={{ label: "Configurar no radar", href: "/app/content-os/radar" }} /></Card>;
  return <div className="space-y-3">{monitors.map((monitor) => { const status = monitor.status ?? "pending"; const failed = status === "failed"; return <Card key={monitor.id}><CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3"><div className="flex min-w-0 items-center gap-3"><span className="rounded-md bg-accent-soft p-2 text-accent"><Buildings size={18} weight="duotone" aria-hidden /></span><div className="min-w-0"><CardTitle className="truncate">{monitor.name}</CardTitle><p className="mt-1 truncate text-xs text-muted-foreground">{monitor.website_url || "Site não informado"}</p></div></div><Badge variant={failed ? "error" : status === "active" ? "success" : "warning"}>{failed ? "Verificar" : statusLabel[status] ?? "Aguardando"}</Badge></CardHeader><CardContent className="grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Páginas monitoradas</p><p className="mt-1 font-medium">{monitor.monitored_pages ?? 0}</p></div><div><p className="text-xs text-muted-foreground">Última verificação</p><p className="mt-1 flex items-center gap-1 font-medium"><Clock size={14} aria-hidden />{monitor.last_checked_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(monitor.last_checked_at)) : "Ainda não verificado"}</p></div><div><p className="text-xs text-muted-foreground">Última mudança</p><p className="mt-1 font-medium">{monitor.last_change || "Nenhuma mudança detectada"}</p></div></CardContent>{failed ? <div className="flex items-center gap-2 border-t border-border px-6 py-3 text-sm text-error-fg"><Warning size={16} aria-hidden />A verificação falhou. Tente novamente mais tarde.</div> : null}{monitor.website_url ? <div className="flex justify-end border-t border-border px-6 py-3"><Button asChild size="sm" variant="link"><a href={monitor.website_url} target="_blank" rel="noreferrer">Abrir site <ArrowSquareOut size={14} aria-hidden /></a></Button></div> : null}</Card>})}</div>;
}
