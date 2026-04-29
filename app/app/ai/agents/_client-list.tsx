"use client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAgentsList } from "@/hooks/ai/useAgents";
import type { AgentRow } from "@/hooks/ai/useAgent";

interface Props {
  initialData: AgentRow[];
  canEdit: boolean;
}

export function AgentsListClient({ initialData, canEdit }: Props) {
  const q = useAgentsList({ initialData });
  const agents = q.data ?? [];

  if (agents.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum agent configurado nesta organização.
        </p>
      </Card>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {agents.map((agent) => (
        <li key={agent.id}>
          <Card className="flex h-full flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-medium">{agent.name}</h3>
                <p className="text-xs text-muted-foreground">{agent.model}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                {agent.is_default && <Badge variant="secondary">default</Badge>}
                <Badge variant={agent.is_active ? "default" : "outline"}>
                  {agent.is_active ? "ativo" : "inativo"}
                </Badge>
              </div>
            </div>
            {agent.description && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{agent.description}</p>
            )}
            <div className="mt-auto pt-2">
              <Link href={`/app/ai/agents/${agent.id}`}>
                <Button variant="outline" size="sm" className="w-full">
                  {canEdit ? "Editar" : "Visualizar"}
                </Button>
              </Link>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
