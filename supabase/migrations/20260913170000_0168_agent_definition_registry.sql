create table if not exists public.agent_definition_registry (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  definition_id text not null check (btrim(definition_id) <> ''),
  definition_version text not null check (btrim(definition_version) <> ''),
  identity text not null, mission text not null, boundaries jsonb not null,
  authority text not null, escalation text not null,
  status text not null check (status = 'CERTIFIED'),
  origin_actor_id text not null, approval_id text not null, approver_id text not null,
  policy_version text not null, approved_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, definition_id, definition_version),
  unique (organization_id, approval_id)
);
alter table public.agent_definition_registry enable row level security;
drop policy if exists agent_definition_registry_tenant_all on public.agent_definition_registry;
create policy agent_definition_registry_tenant_all on public.agent_definition_registry for all to authenticated
using (organization_id in (select public.fn_user_org_ids()))
with check (organization_id in (select public.fn_user_org_ids()));
grant select, insert on public.agent_definition_registry to authenticated;
grant all on public.agent_definition_registry to service_role;
