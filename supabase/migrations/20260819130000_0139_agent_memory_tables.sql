-- Phase 9: Agent Multi-Turn Continuity + Memory
-- Tables: agent_memory, agent_decisions, agent_errors (append-only, org-scoped)

create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  memory_type text not null check (memory_type in ('conversation', 'decision', 'preference', 'issue', 'resolution')),
  content text not null,
  context jsonb default '{}',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, agent_id, contact_id, memory_type, content)
);

create index if not exists agent_memory_org_agent_contact on public.agent_memory(organization_id, agent_id, contact_id);
create index if not exists agent_memory_expires on public.agent_memory(expires_at) where expires_at is not null;

alter table public.agent_memory enable row level security;

drop policy if exists "agent_memory_org_isolation" on public.agent_memory;
create policy "agent_memory_org_isolation" on public.agent_memory
  for all
  using (organization_id = any(fn_user_org_ids()));

create table if not exists public.agent_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  decision text not null,
  reason text,
  outcome text check (outcome in ('success', 'partial', 'rejected', 'pending', 'unknown')),
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists agent_decisions_org_agent_contact on public.agent_decisions(organization_id, agent_id, contact_id, created_at desc);
create index if not exists agent_decisions_outcome on public.agent_decisions(outcome);

alter table public.agent_decisions enable row level security;

drop policy if exists "agent_decisions_org_isolation" on public.agent_decisions;
create policy "agent_decisions_org_isolation" on public.agent_decisions
  for all
  using (organization_id = any(fn_user_org_ids()));

create table if not exists public.agent_errors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  error_type text not null check (error_type in ('parsing_error', 'api_error', 'policy_denied', 'context_limit', 'retrieval_failed', 'unknown')),
  message text not null,
  recovery_taken text,
  severity text check (severity in ('warning', 'error', 'critical')),
  created_at timestamptz not null default now()
);

create index if not exists agent_errors_org_agent_contact on public.agent_errors(organization_id, agent_id, contact_id, created_at desc);
create index if not exists agent_errors_severity on public.agent_errors(severity);

alter table public.agent_errors enable row level security;

drop policy if exists "agent_errors_org_isolation" on public.agent_errors;
create policy "agent_errors_org_isolation" on public.agent_errors
  for all
  using (organization_id = any(fn_user_org_ids()));

-- View: recent agent memory for context API
create or replace view public.agent_context_view as
select
  organization_id,
  agent_id,
  contact_id,
  jsonb_agg(jsonb_build_object(
    'id', id,
    'type', memory_type,
    'content', content,
    'created_at', created_at
  ) order by created_at desc)
  filter (where expires_at is null or expires_at > now()) as memories,
  count(*) filter (where expires_at is null or expires_at > now()) as memory_count
from public.agent_memory
group by organization_id, agent_id, contact_id;
