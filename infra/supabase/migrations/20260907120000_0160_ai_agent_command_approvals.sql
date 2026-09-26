-- V1 Nova Mode: durable, tenant-scoped confirmation records for browser commands.
create table if not exists public.ai_agent_command_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  agent_version_id uuid not null references public.ai_agent_versions(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  trace_id uuid not null,
  tool_name text not null check (btrim(tool_name) <> ''),
  tool_args jsonb not null default '{}'::jsonb,
  message text not null check (btrim(message) <> ''),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key uuid not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','denied','executing','executed','expired','failed')),
  expires_at timestamptz not null,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  decision_reason text,
  executed_at timestamptz,
  execution_result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  check (expires_at > created_at)
);

create index if not exists ai_agent_command_approvals_pending_idx
  on public.ai_agent_command_approvals (organization_id, expires_at)
  where status = 'pending';

create or replace function public.fn_ai_agent_command_approval_tenant_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1
      from public.ai_agents a
      join public.ai_agent_versions v
        on v.id = new.agent_version_id
       and v.agent_id = a.id
       and v.organization_id = a.organization_id
     where a.id = new.agent_id
       and a.organization_id = new.organization_id
  ) then
    raise exception 'agent_command_approval_tenant_mismatch' using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ai_agent_command_approval_tenant_guard
  on public.ai_agent_command_approvals;
create trigger trg_ai_agent_command_approval_tenant_guard
  before insert or update of organization_id, agent_id, agent_version_id
  on public.ai_agent_command_approvals
  for each row execute function public.fn_ai_agent_command_approval_tenant_guard();

alter table public.ai_agent_command_approvals enable row level security;

drop policy if exists ai_agent_command_approvals_manager_all
  on public.ai_agent_command_approvals;
create policy ai_agent_command_approvals_manager_all
  on public.ai_agent_command_approvals
  for all to authenticated
  using (
    organization_id in (select public.fn_user_org_ids())
    and public.fn_role_at_least(organization_id, 'manager')
  )
  with check (
    organization_id in (select public.fn_user_org_ids())
    and public.fn_role_at_least(organization_id, 'manager')
  );

grant select, insert, update on public.ai_agent_command_approvals to authenticated;
grant all on public.ai_agent_command_approvals to service_role;
revoke all on function public.fn_ai_agent_command_approval_tenant_guard() from public, anon;
grant execute on function public.fn_ai_agent_command_approval_tenant_guard() to authenticated, service_role;

notify pgrst, 'reload schema';
