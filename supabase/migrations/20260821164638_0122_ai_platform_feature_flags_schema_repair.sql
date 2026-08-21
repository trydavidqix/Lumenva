-- 0122: repara ai_platform_feature_flags — a tabela em produção foi criada fora
-- do pipeline de migrations (SQL manual pelo Editor do Supabase, sessão de
-- 2026-08-18, ver docs/phase-8-status.md linha ~110-118) com um schema
-- inventado na hora (feature_name/status/rolled_out_percentage) que nunca
-- bateu com o que o código sempre esperou (feature/mode/config, definido pela
-- migration 20260810151119_0116_ai_platform_foundation). Como
-- `create table if not exists` não dá erro quando a tabela já existe com
-- outro schema, essa divergência nunca gerou erro visível — só quebraria
-- silenciosamente (500) no primeiro caminho de código que de fato lesse a
-- tabela via `resolveAiPlatformFeature()` (lib/agent-engine/platform/features.ts).
--
-- Esta migration preserva a tabela antiga (renomeia, não derruba dado de
-- produção) e recria a tabela certa. Depois, migra pro novo formato só os 2
-- flags que já estavam `status='ON'` de propósito na tabela antiga
-- (langgraph_automation_workflow, langgraph_lead_scoring_workflow) — mantém
-- o efeito já decidido e ativo, não é uma promoção nova. Os outros flags da
-- tabela antiga (agent_continuity_enabled, ai_360_human_escalation,
-- flywheel_system_enabled, followup_system_enabled, human_cases_enabled,
-- langgraph_durable_benchmark_enabled, mcp_catalog_live,
-- multi_model_orchestration_enabled) não fazem parte do vocabulário atual da
-- `main` — pertencem a uma branch experimental separada
-- (.worktrees/agent-os-phase-7-durable-benchmark) — e ficam preservados sem
-- efeito na tabela renomeada, não são migrados nem apagados.
do $$
declare
  v_has_feature_col boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ai_platform_feature_flags'
      and column_name = 'feature'
  ) into v_has_feature_col;

  if not v_has_feature_col and exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_platform_feature_flags'
  ) then
    execute 'alter table public.ai_platform_feature_flags rename to ai_platform_feature_flags_legacy_20260821';
  end if;
end $$;

create table if not exists public.ai_platform_feature_flags (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade,
  feature text not null check (feature in (
    'langsmith','mem0','llamaindex','graphiti','external_guardrails','n8n',
    'langgraph_proposal_workflow','langgraph_automation_workflow','langgraph_lead_scoring_workflow'
  )),
  mode text not null default 'off' check (mode in ('off','shadow','canary','on')),
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ai_platform_feature_flags_scope_unique unique nulls not distinct (organization_id, feature)
);

alter table public.ai_platform_feature_flags enable row level security;

drop policy if exists tenant_isolation_ai_platform_feature_flags_all on public.ai_platform_feature_flags;
create policy tenant_isolation_ai_platform_feature_flags_all on public.ai_platform_feature_flags for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

grant select, insert, update, delete on public.ai_platform_feature_flags to authenticated;
grant all on public.ai_platform_feature_flags to service_role;

-- Preserva a decisão já tomada e ativa (status='ON', todos os tenants) — não
-- é uma promoção nova, é manter o efeito atual sem regressão. Só roda se a
-- tabela legada existir (idempotente: reaplicar a migration não duplica,
-- `on conflict` cobre o caso da tabela já ter sido recriada antes).
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'ai_platform_feature_flags_legacy_20260821'
  ) then
    insert into public.ai_platform_feature_flags (organization_id, feature, mode)
    select null, legacy.feature_name, 'on'
    from public.ai_platform_feature_flags_legacy_20260821 legacy
    where legacy.feature_name in ('langgraph_automation_workflow', 'langgraph_lead_scoring_workflow')
      and legacy.status = 'ON'
    on conflict (organization_id, feature) do update set mode = excluded.mode, updated_at = now();
  end if;
end $$;
