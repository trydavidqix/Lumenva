-- Wave 1 Operating Core: tenant-scoped execution receipts.
-- Receipt is an auditable result; it never grants authority or replaces evidence.
create table if not exists public.operating_core_receipts (
  id text primary key check (btrim(id) <> ''),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  execution_id text not null check (btrim(execution_id) <> ''),
  job_id text,
  action text not null check (btrim(action) <> ''),
  status text not null check (status in ('SUCCEEDED','DENIED','FAILED','NOT_PROVEN')),
  actor_id text not null check (btrim(actor_id) <> ''),
  policy_version text not null check (btrim(policy_version) <> ''),
  permission_level text not null check (permission_level in ('P0','P1','P2','P3','P4')),
  risk_level text not null check (risk_level in ('R0','R1','R2','R3','R4')),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  result jsonb not null default '{}'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  contract_version text not null default 'wave1-v1',
  unique (organization_id, idempotency_key)
);

create index if not exists operating_core_receipts_job_idx
  on public.operating_core_receipts (organization_id, job_id, created_at desc);

alter table public.operating_core_receipts enable row level security;
drop policy if exists operating_core_receipts_tenant_all on public.operating_core_receipts;
create policy operating_core_receipts_tenant_all
  on public.operating_core_receipts
  for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

grant select, insert, update on public.operating_core_receipts to authenticated;
grant all on public.operating_core_receipts to service_role;
notify pgrst, 'reload schema';
