-- Wave 2 Agent Birth: server-owned actor and approval authority records.
create table if not exists public.agent_birth_actors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  actor_id text not null check (btrim(actor_id) <> ''),
  actor_type text not null check (actor_type in ('HUMAN','AGENT','SYSTEM','OWNER_GATEWAY')),
  active boolean not null default true,
  source_ref text not null check (btrim(source_ref) <> ''),
  created_at timestamptz not null default now(),
  unique (tenant_id, actor_id)
);

create table if not exists public.agent_birth_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  approval_id text not null check (btrim(approval_id) <> ''),
  definition_id text not null check (btrim(definition_id) <> ''),
  definition_version text not null check (btrim(definition_version) <> ''),
  author_actor_id text not null check (btrim(author_actor_id) <> ''),
  approver_id text not null check (btrim(approver_id) <> ''),
  status text not null check (status in ('APPROVED','DENIED')),
  approved_at timestamptz not null,
  policy_version text not null check (btrim(policy_version) <> ''),
  signature text,
  created_at timestamptz not null default now(),
  unique (tenant_id, approval_id)
);

create index if not exists agent_birth_approvals_lookup_idx
  on public.agent_birth_approvals (tenant_id, definition_id, definition_version, author_actor_id, approver_id);

alter table public.agent_birth_actors enable row level security;
alter table public.agent_birth_approvals enable row level security;
drop policy if exists agent_birth_actors_tenant_all on public.agent_birth_actors;
drop policy if exists agent_birth_approvals_tenant_all on public.agent_birth_approvals;
create policy agent_birth_actors_tenant_all on public.agent_birth_actors for all to authenticated
  using (tenant_id in (select public.fn_user_org_ids()))
  with check (tenant_id in (select public.fn_user_org_ids()));
create policy agent_birth_approvals_tenant_all on public.agent_birth_approvals for all to authenticated
  using (tenant_id in (select public.fn_user_org_ids()))
  with check (tenant_id in (select public.fn_user_org_ids()));

grant select on public.agent_birth_actors, public.agent_birth_approvals to authenticated;
grant all on public.agent_birth_actors, public.agent_birth_approvals to service_role;
notify pgrst, 'reload schema';
