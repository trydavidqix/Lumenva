"use client";

import { useState } from "react";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, GitBranch } from "@/lib/ui/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MergeDialog } from "@/components/contacts/MergeDialog";
import { useMergeQueue, type MergeQueueItem } from "@/hooks/contacts/useMergeQueue";

export function MergeQueueList() {
  const queue = useMergeQueue();
  const [selected, setSelected] = useState<MergeQueueItem | null>(null);

  if (queue.isLoading) return <Skeleton className="h-40 w-full" />;
  if (queue.isError) return <p className="text-sm text-error-fg">Não foi possível carregar a fila de merges.</p>;
  const items = queue.data?.data ?? [];
  if (items.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum merge pendente.</Card>;
  }

  return (
    <>
      <div className="space-y-3" aria-label="Fila de merges">
        {items.map((item) => (
          <Card key={item.id} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <GitBranch size={18} aria-hidden className="shrink-0 text-muted-foreground" />
                <span className="font-medium">Possível duplicado</span>
                <Badge variant="warning">Pendente</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.candidates.length} candidatos · {formatRelative(new Date(item.created_at), new Date(), { locale: ptBR })}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setSelected(item)}>
              Revisar <ArrowRight size={16} aria-hidden />
            </Button>
          </Card>
        ))}
      </div>
      <MergeDialog queueItemId={selected?.id ?? null} open={selected !== null} onOpenChange={(open) => !open && setSelected(null)} onResolved={() => { setSelected(null); void queue.refetch(); }} />
    </>
  );
}
