create table if not exists public.voice_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('telnyx')),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, phone_e164)
);

create index if not exists voice_phone_numbers_org_idx
  on public.voice_phone_numbers (organization_id, enabled);

alter table public.voice_phone_numbers enable row level security;

create policy voice_phone_numbers_select_org on public.voice_phone_numbers
for select to authenticated
using (organization_id in (select public.fn_user_org_ids()));

create policy voice_phone_numbers_insert_org on public.voice_phone_numbers
for insert to authenticated
with check (organization_id in (select public.fn_user_org_ids()));

create policy voice_phone_numbers_update_org on public.voice_phone_numbers
for update to authenticated
using (organization_id in (select public.fn_user_org_ids()))
with check (organization_id in (select public.fn_user_org_ids()));

create policy voice_phone_numbers_delete_org on public.voice_phone_numbers
for delete to authenticated
using (organization_id in (select public.fn_user_org_ids()));
