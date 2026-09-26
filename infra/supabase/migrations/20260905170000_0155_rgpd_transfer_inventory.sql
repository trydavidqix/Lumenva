-- J5 international transfer inventory. Catalog only; gate remains OFF by default.
create table if not exists public.transfer_inventories (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_name text not null, country_code text, subprocessor text, purpose text, data_location text,
  adequacy_decision text not null default 'unknown' check (adequacy_decision in ('adequate','not_adequate','unknown')),
  safeguards text not null default 'unknown' check (safeguards in ('scc','bcr','none','unknown')), safeguards_version text,
  tia jsonb not null default '{}'::jsonb, supplementary_measures jsonb not null default '{}'::jsonb,
  encryption text, reviewed_at timestamptz, status text not null default 'unknown' check (status in ('unknown','approved','blocked','expired')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (organization_id, provider_name)
);
create index if not exists transfer_inventories_org_status_idx on public.transfer_inventories(organization_id, status);
alter table public.transfer_inventories enable row level security;
revoke all on public.transfer_inventories from anon, authenticated;
grant select, insert, update on public.transfer_inventories to authenticated;
grant all on public.transfer_inventories to service_role;
drop policy if exists transfer_inventories_select on public.transfer_inventories;
create policy transfer_inventories_select on public.transfer_inventories for select using (organization_id in (select public.fn_user_org_ids()));
drop policy if exists transfer_inventories_write on public.transfer_inventories;
create policy transfer_inventories_write on public.transfer_inventories for all using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
