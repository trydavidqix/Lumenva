create table if not exists public.layer_reuse_approvals (
  id uuid primary key default gen_random_uuid(),
  approval_id text not null,
  organization_id text not null,
  status text not null check (status in ('APPROVED','REVOKED','EXPIRED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint layer_reuse_approvals_org_id_key unique (organization_id, approval_id)
);

create index if not exists layer_reuse_approvals_lookup_idx
  on public.layer_reuse_approvals (organization_id, approval_id, status, expires_at);

alter table public.layer_reuse_approvals enable row level security;
drop policy if exists layer_reuse_approvals_tenant_all on public.layer_reuse_approvals;
create policy layer_reuse_approvals_tenant_all
  on public.layer_reuse_approvals
  for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

grant select, insert, update on public.layer_reuse_approvals to authenticated;
grant all on public.layer_reuse_approvals to service_role;
