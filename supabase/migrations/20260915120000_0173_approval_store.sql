-- Durable backing store for the agent-engine ApprovalStore contract.
-- The payload keeps the policy contract independent from transport-specific
-- columns while status remains a first-class conditional-update key.
create table if not exists public.approval_requests (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'executing', 'executed', 'expired', 'cancelled')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approval_requests_pending_idx
  on public.approval_requests (organization_id, updated_at)
  where status = 'pending';

alter table public.approval_requests enable row level security;

drop policy if exists approval_requests_select on public.approval_requests;
create policy approval_requests_select
  on public.approval_requests
  for select to authenticated
  using (
    organization_id in (select public.fn_user_org_ids())
    or public.fn_is_platform_admin()
  );

drop policy if exists approval_requests_insert on public.approval_requests;
create policy approval_requests_insert
  on public.approval_requests
  for insert to authenticated
  with check (
    organization_id in (select public.fn_user_org_ids())
    or public.fn_is_platform_admin()
  );

drop policy if exists approval_requests_update on public.approval_requests;
create policy approval_requests_update
  on public.approval_requests
  for update to authenticated
  using (
    organization_id in (select public.fn_user_org_ids())
    or public.fn_is_platform_admin()
  )
  with check (
    organization_id in (select public.fn_user_org_ids())
    or public.fn_is_platform_admin()
  );

grant select, insert, update on public.approval_requests to authenticated;
grant all on public.approval_requests to service_role;

notify pgrst, 'reload schema';
