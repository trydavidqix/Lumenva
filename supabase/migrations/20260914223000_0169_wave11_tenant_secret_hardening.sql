-- Wave 11 forward-fix: canonical tenant UUIDs and server-only integration secrets.
-- Existing non-UUID organization identifiers are rejected rather than silently remapped.

alter table public.contact_consents
  alter column organization_id type uuid using organization_id::uuid;

alter table public.integration_webhook_receipts
  alter column organization_id type uuid using organization_id::uuid;

alter table public.integration_secrets
  alter column organization_id type uuid using organization_id::uuid;

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
end $$;

alter table public.integration_secrets enable row level security;
drop policy if exists integration_secrets_tenant on public.integration_secrets;
revoke all on public.integration_secrets from public;
revoke all on public.integration_secrets from authenticated;
grant select on public.integration_secrets to service_role;
grant insert, update, delete on public.integration_secrets to service_role;
