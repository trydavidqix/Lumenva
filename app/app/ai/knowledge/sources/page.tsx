import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import type { SourceRow } from "@/hooks/ai/useKnowledgeSources";
import { KnowledgeSourcesClient } from "./_client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function KnowledgeSourcesPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const supabase = await createClient();

  const { data: orgAgents } = await supabase
    .from("ai_agents")
    .select("id, name, is_default")
    .eq("organization_id", activeOrg.orgId)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  const agents = orgAgents ?? [];

  const sp = await searchParams;
  const requestedAgentId = typeof sp.agentId === "string" ? sp.agentId : undefined;

  // Cada org gerencia o conhecimento de TODOS os seus agentes aqui, não só
  // do default — a tela era hardcoded pro default (bloqueava configurar
  // conhecimento de qualquer outro agente da org). `agentId` na query
  // troca o agente ativo; sem parâmetro válido, cai no default de sempre.
  const agent =
    (requestedAgentId ? agents.find((a) => a.id === requestedAgentId) : undefined) ??
    agents.find((a) => a.is_default) ??
    null;

  if (!agent) {
    return (
      <div className="flex h-full flex-col gap-6 p-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Fontes de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">
            Configure as fontes de RAG do agent default da organização.
          </p>
        </header>
        <div className="rounded-lg border border-border bg-surface p-6 text-sm">
          <p className="mb-4">
            Nenhum agent default encontrado. Crie um agent default em{" "}
            <span className="font-mono">/app/ai/agents</span> primeiro.
          </p>
          <Button asChild variant="primary" size="sm">
            <Link href="/app/ai/agents">Ir para Agents</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { data: sourcesRaw } = await supabase
    .from("ai_knowledge_sources")
    .select("*")
    .eq("organization_id", activeOrg.orgId)
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: true });

  const initialSources = (sourcesRaw ?? []) as unknown as SourceRow[];

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fontes de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">
            Status e ações sobre as fontes RAG do agent <span className="font-medium">{agent.name}</span>.
          </p>
        </div>
        {agents.length > 1 && (
          <nav className="flex flex-wrap gap-2" aria-label="Selecionar agente">
            {agents.map((a) => {
              const isActive = a.id === agent.id;
              return (
                <Link
                  key={a.id}
                  href={`/app/ai/knowledge/sources?agentId=${a.id}`}
                  className={
                    isActive
                      ? "rounded-sm border border-accent bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent"
                      : "rounded-sm border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-accent hover:text-accent"
                  }
                >
                  {a.name}
                  {a.is_default && <span className="ml-1 text-xs opacity-70">(default)</span>}
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      <KnowledgeSourcesClient agentId={agent.id} initialSources={initialSources} />
    </div>
  );
}
