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
