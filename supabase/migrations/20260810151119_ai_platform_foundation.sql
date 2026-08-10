create table if not exists public.ai_platform_feature_flags (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid references public.organizations(id) on delete cascade,
  feature text not null check (feature in ('langsmith','mem0','llamaindex','graphiti','external_guardrails','n8n','langgraph_proposal_workflow')),
  mode text not null default 'off' check (mode in ('off','shadow','canary','on')),
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ai_platform_feature_flags_scope_unique unique nulls not distinct (organization_id, feature)
);

create table if not exists public.ai_projection_ledger (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  projection_type text not null check (projection_type in ('memory','graph')),
  provider text not null,
  entity_type text not null,
  entity_id text not null,
  source_id text not null,
  source_version text not null,
  idempotency_key text not null,
  status text not null default 'pending' check (status in ('pending','processing','applied','failed','deleted')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz,
  last_error_code text,
  last_error_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_projection_ledger_idempotency_key unique (organization_id, projection_type, provider, idempotency_key)
);

create index if not exists ai_projection_ledger_retry_idx on public.ai_projection_ledger (next_attempt_at) where status in ('pending','failed');

alter table public.ai_platform_feature_flags enable row level security;
alter table public.ai_projection_ledger enable row level security;
drop policy if exists tenant_isolation_ai_platform_feature_flags_all on public.ai_platform_feature_flags;
create policy tenant_isolation_ai_platform_feature_flags_all on public.ai_platform_feature_flags for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));
drop policy if exists tenant_isolation_ai_projection_ledger_all on public.ai_projection_ledger;
create policy tenant_isolation_ai_projection_ledger_all on public.ai_projection_ledger for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

grant select, insert, update, delete on public.ai_platform_feature_flags, public.ai_projection_ledger to authenticated;
grant all on public.ai_platform_feature_flags, public.ai_projection_ledger to service_role;
