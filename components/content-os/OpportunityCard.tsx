"use client";

import { ArrowRight, Check, X } from "@/lib/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export type ContentOpportunity = {
  id: string;
  title: string;
  rationale?: string | null;
  priority?: number | null;
  status?: string | null;
  created_at?: string | null;
};

function priorityVariant(priority: number): "error" | "warning" | "neutral" {
  if (priority >= 80) return "error";
  if (priority >= 50) return "warning";
  return "neutral";
}

export function OpportunityCard({ opportunity, onDecision }: { opportunity: ContentOpportunity; onDecision?: (status: "accepted" | "rejected") => void }) {
  const priority = opportunity.priority ?? 0;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="leading-snug">{opportunity.title}</CardTitle>
          <Badge variant={priorityVariant(priority)}>{priority >= 80 ? "Alta" : priority >= 50 ? "Média" : "Baixa"}</Badge>
        </div>
        {opportunity.created_at ? <p className="text-xs text-muted-foreground">Encontrada {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(opportunity.created_at))}</p> : null}
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        <p className="text-sm leading-relaxed text-muted-foreground">{opportunity.rationale || "Uma pauta relevante para a sua operação."}</p>
      </CardContent>
      {onDecision ? (
        <CardFooter className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button size="sm" onClick={() => onDecision("accepted")}><Check size={15} aria-hidden /> Criar conteúdo</Button>
          <Button size="sm" variant="ghost" onClick={() => onDecision("rejected")}><X size={15} aria-hidden /> Ignorar</Button>
          <Button size="sm" variant="link" className="ml-auto"><ArrowRight size={15} aria-hidden /> Ver origem</Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
