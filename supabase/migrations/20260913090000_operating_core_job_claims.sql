create table if not exists public.operating_core_job_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  job_id text not null,
  worker_id text not null,
  status text not null check (status in ('CLAIMED', 'RELEASED')),
  attempts integer not null default 0 check (attempts >= 0),
  claimed_at timestamptz not null default now(),
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operating_core_job_claims_org_job_key unique (organization_id, job_id)
);

create index if not exists operating_core_job_claims_worker_idx
  on public.operating_core_job_claims (organization_id, worker_id, status);

alter table public.operating_core_job_claims enable row level security;

drop policy if exists operating_core_job_claims_tenant_isolation on public.operating_core_job_claims;
create policy operating_core_job_claims_tenant_isolation
  on public.operating_core_job_claims
  for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

grant select, insert, update, delete on public.operating_core_job_claims to authenticated;
