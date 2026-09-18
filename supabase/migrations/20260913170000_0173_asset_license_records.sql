create table if not exists public.asset_license_records (
  organization_id text not null,
  license_ref text not null,
  source_id text not null,
  owner_id text not null,
  status text not null check (status in ('REGISTERED','VERIFIED','SUPERSEDED','REVOKED')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, license_ref)
);
alter table public.asset_license_records enable row level security;
drop policy if exists asset_license_records_tenant_all on public.asset_license_records;
create policy asset_license_records_tenant_all on public.asset_license_records for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));
grant select on public.asset_license_records to authenticated;
grant all on public.asset_license_records to service_role;
