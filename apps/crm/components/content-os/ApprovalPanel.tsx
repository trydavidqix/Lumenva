"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, X, ArrowRight } from "@/lib/ui/icons";
import type { ContentDraftStatus } from "./ContentEditor";

export type ApprovalEvent = { status: ContentDraftStatus; actor: string; at: string; note?: string };
export type ApprovalPanelProps = { status: ContentDraftStatus; events?: ApprovalEvent[]; canApprove?: boolean; onTransition?: (status: ContentDraftStatus, note: string) => Promise<void> | void; className?: string };

const labels: Record<ContentDraftStatus, string> = { draft: "Rascunho", in_review: "Em revisão", approved: "Aprovado", scheduled: "Agendado", published: "Publicado" };

export function ApprovalPanel({ status, events = [], canApprove = false, onTransition, className }: ApprovalPanelProps) {
  const [note, setNote] = React.useState("");
  const [working, setWorking] = React.useState(false);
  const terminal = status === "scheduled" || status === "published";
  async function transition(next: ContentDraftStatus) { setWorking(true); try { await onTransition?.(next, note); setNote(""); } finally { setWorking(false); } }
  return <Card className={className}><CardHeader><CardTitle className="flex items-center justify-between gap-2">Aprovação <Badge variant={status === "approved" || status === "published" ? "success" : status === "in_review" ? "warning" : "neutral"}>{labels[status]}</Badge></CardTitle></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><label htmlFor="approval-note" className="text-sm font-medium">Nota para a revisão <span className="font-normal text-text-muted">(opcional)</span></label><Textarea id="approval-note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Registre o contexto da decisão." disabled={!canApprove || terminal} /></div>{canApprove && !terminal ? <div className="flex flex-wrap gap-2">{status === "draft" ? <Button type="button" variant="secondary" onClick={() => void transition("in_review")} disabled={working}><ArrowRight aria-hidden="true" /> Enviar para revisão</Button> : null}{status === "in_review" ? <><Button type="button" onClick={() => void transition("approved")} disabled={working}><Check aria-hidden="true" /> Aprovar</Button><Button type="button" variant="destructive" onClick={() => void transition("draft")} disabled={working}><X aria-hidden="true" /> Pedir alterações</Button></> : null}</div> : null}<ol className="space-y-3 border-l border-border pl-4" aria-label="Histórico de aprovação">{events.length ? events.map((event) => <li key={`${event.status}-${event.at}`} className="relative"><span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-accent" aria-hidden="true" /><p className="text-sm font-medium">{labels[event.status]}</p><p className="text-xs text-text-muted">{event.actor} · {new Date(event.at).toLocaleString("pt-BR")}</p>{event.note ? <p className="mt-1 text-sm text-text-muted">{event.note}</p> : null}</li>) : <li className="text-sm text-text-muted">Nenhuma decisão registrada ainda.</li>}</ol></CardContent></Card>;
}
