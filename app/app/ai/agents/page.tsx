import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import type { AgentRow } from "@/hooks/ai/useAgent";
import { AgentsListClient } from "./_client-list";

export const dynamic = "force-dynamic";

const AGENT_COLUMNS =
  "id, organization_id, name, description, model, system_prompt, is_active, is_default, config, guardrails, active_kb_version_id, created_at, updated_at";

export default async function AgentsListPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_agents")
    .select(AGENT_COLUMNS)
    .eq("organization_id", activeOrg.orgId)
    .order("created_at", { ascending: false });

  const agents = (data ?? []) as unknown as AgentRow[];

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Agents de IA</h1>
        <p className="text-sm text-muted-foreground">
          Configure o comportamento do chatbot RAG da organização.
        </p>
      </header>
      <AgentsListClient initialData={agents} canEdit={ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin} />
    </div>
  );
}
