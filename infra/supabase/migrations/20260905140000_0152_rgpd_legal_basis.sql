-- J4 legal basis per purpose. Legacy contacts.consent remains untouched.
create table if not exists public.contact_legal_bases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  purpose text not null,
  legal_basis text not null,
  text_version text,
  recorded_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  channel text,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint contact_legal_bases_purpose_check check (purpose in ('marketing','transactional','profiling')),
  constraint contact_legal_bases_basis_check check (legal_basis in ('consent','contract','legal_obligation','legitimate_interests','vital_interests','public_task'))
);
create index if not exists contact_legal_bases_org_contact_idx on public.contact_legal_bases(organization_id, contact_id, purpose);
alter table public.contact_legal_bases enable row level security;
revoke all on public.contact_legal_bases from anon, authenticated;
grant select, insert on public.contact_legal_bases to authenticated;
grant all on public.contact_legal_bases to service_role;
drop policy if exists contact_legal_bases_select on public.contact_legal_bases;
create policy contact_legal_bases_select on public.contact_legal_bases for select using (organization_id in (select public.fn_user_org_ids()));
drop policy if exists contact_legal_bases_insert on public.contact_legal_bases;
create policy contact_legal_bases_insert on public.contact_legal_bases for insert with check (organization_id in (select public.fn_user_org_ids()));
