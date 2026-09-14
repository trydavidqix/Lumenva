-- Wave 11 forward-fix: canonical tenant UUIDs, retry-safe replay state, and server-only secret writes.
-- Existing non-UUID organization identifiers are rejected rather than silently remapped.
-- Drop RLS policies before ALTER TYPE: PostgreSQL policies depend on organization_id.

drop policy if exists contact_consents_tenant_all on public.contact_consents;
drop policy if exists integration_webhook_receipts_tenant on public.integration_webhook_receipts;
drop policy if exists integration_secrets_tenant on public.integration_secrets;

alter table public.contact_consents
  alter column organization_id type uuid using organization_id::uuid;

alter table public.integration_webhook_receipts
  alter column organization_id type uuid using organization_id::uuid;

alter table public.integration_secrets
  alter column organization_id type uuid using organization_id::uuid;

alter table public.integration_webhook_receipts
  add column if not exists status text not null default 'PROCESSED',
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists completed_at timestamptz;

update public.integration_webhook_receipts
set completed_at = coalesce(completed_at, received_at)
where status = 'PROCESSED' and completed_at is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contact_consents_organization_id_fkey'
      and conrelid = 'public.contact_consents'::regclass
  ) then
    alter table public.contact_consents
      add constraint contact_consents_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'integration_webhook_receipts_organization_id_fkey'
      and conrelid = 'public.integration_webhook_receipts'::regclass
  ) then
    alter table public.integration_webhook_receipts
      add constraint integration_webhook_receipts_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'integration_secrets_organization_id_fkey'
      and conrelid = 'public.integration_secrets'::regclass
  ) then
    alter table public.integration_secrets
      add constraint integration_secrets_organization_id_fkey
      foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'integration_webhook_receipts_status_check'
      and conrelid = 'public.integration_webhook_receipts'::regclass
  ) then
    alter table public.integration_webhook_receipts
      add constraint integration_webhook_receipts_status_check
      check (status in ('PROCESSING','PROCESSED','FAILED'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'integration_webhook_receipts_state_check'
      and conrelid = 'public.integration_webhook_receipts'::regclass
  ) then
    alter table public.integration_webhook_receipts
      add constraint integration_webhook_receipts_state_check check (
        (status = 'PROCESSING' and claim_token is not null and claimed_at is not null and completed_at is null)
        or (status = 'PROCESSED' and claim_token is null and completed_at is not null)
        or (status = 'FAILED' and claim_token is null and completed_at is null)
      );
  end if;
end $$;

alter table public.contact_consents enable row level security;
create policy contact_consents_tenant_all on public.contact_consents
  for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));
revoke all on public.contact_consents from public;
grant select, insert, update on public.contact_consents to authenticated;

alter table public.integration_webhook_receipts enable row level security;
create policy integration_webhook_receipts_tenant on public.integration_webhook_receipts
  for select to authenticated
  using (organization_id in (select public.fn_user_org_ids()));
revoke all on public.integration_webhook_receipts from public;
revoke all on public.integration_webhook_receipts from authenticated;
grant select on public.integration_webhook_receipts to authenticated;
grant select, insert, update, delete on public.integration_webhook_receipts to service_role;

alter table public.integration_secrets enable row level security;
revoke all on public.integration_secrets from public;
revoke all on public.integration_secrets from authenticated;
grant select, insert, update, delete on public.integration_secrets to service_role;
