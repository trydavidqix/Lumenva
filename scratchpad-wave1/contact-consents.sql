create table if not exists public.contact_consents (
  id uuid primary key default gen_random_uuid(),
  consent_id text not null,
  organization_id text not null,
  subject_ref text not null,
  purpose text not null,
  channel text not null check (channel in ('whatsapp','email','voice')),
  legal_basis_ref text,
  status text not null check (status in ('GRANTED','REVOKED','EXPIRED','UNKNOWN')),
  granted_at timestamptz,
  revoked_at timestamptz,
  retention_until timestamptz,
  source_refs jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_consents_org_id_key unique (organization_id, consent_id)
);

create index if not exists contact_consents_lookup_idx
  on public.contact_consents (organization_id, subject_ref, channel, purpose, status);

alter table public.contact_consents enable row level security;
drop policy if exists contact_consents_tenant_all on public.contact_consents;
create policy contact_consents_tenant_all on public.contact_consents
  for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));
grant select, insert, update on public.contact_consents to authenticated;
