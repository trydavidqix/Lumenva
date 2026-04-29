"use client";
import { useState } from "react";
import { useBoard } from "@/hooks/kanban/useBoard";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { FilterBar } from "@/components/kanban/FilterBar";
import { BulkActionBar } from "@/components/kanban/BulkActionBar";
import type { LeadFilters } from "@/lib/kanban/filters";
import { applyFilters } from "@/lib/kanban/filters";

export function PipelinePageClient({
  pipelineId,
  initialName,
}: {
  pipelineId: string;
  initialName: string;
}) {
  const { data, isLoading, error } = useBoard(pipelineId);
  const [filters, setFilters] = useState<LeadFilters>({ status: "all" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredLeads = data ? applyFilters(data.leads, filters) : [];

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          {data?.pipeline.name ?? initialName}
        </h1>
      </header>
      <FilterBar filters={filters} onChange={setFilters} leads={data?.leads ?? []} />
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">
          Erro ao carregar pipeline:{" "}
          {error instanceof Error ? error.message : String(error)}
        </div>
      ) : isLoading || !data ? (
        <div className="flex flex-1 animate-pulse items-center justify-center text-muted-foreground">
          Carregando…
        </div>
      ) : (
        <KanbanBoard
          pipelineId={pipelineId}
          stages={data.stages}
          leads={filteredLeads}
          pipeline={data.pipeline}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}
      <BulkActionBar
        selectedIds={selectedIds}
        stages={data?.stages ?? []}
        pipelineId={pipelineId}
        onClear={() => setSelectedIds([])}
      />
    </div>
  );
}
