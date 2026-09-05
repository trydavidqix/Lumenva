-- J6 explicit erasure versus irreversible anonymisation decision.
create table if not exists public.erasure_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  request_id uuid references public.lgpd_requests(id) on delete set null,
  result text not null check (result in ('erasure','irreversible_anonymisation')),
  legal_exception text,
  retained_fields jsonb not null default '{}'::jsonb,
  irreversibility_proof text not null,
  created_at timestamptz not null default now()
);
create index if not exists erasure_decisions_org_contact_idx on public.erasure_decisions(organization_id, contact_id, created_at);
alter table public.erasure_decisions enable row level security;
revoke all on public.erasure_decisions from anon, authenticated;
grant select, insert on public.erasure_decisions to authenticated;
grant all on public.erasure_decisions to service_role;
drop policy if exists erasure_decisions_select on public.erasure_decisions;
create policy erasure_decisions_select on public.erasure_decisions for select using (organization_id in (select public.fn_user_org_ids()));
drop policy if exists erasure_decisions_insert on public.erasure_decisions;
create policy erasure_decisions_insert on public.erasure_decisions for insert with check (organization_id in (select public.fn_user_org_ids()));
