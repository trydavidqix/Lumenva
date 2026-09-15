-- 0175 — align tenant identifiers with public.organizations.id.
--
-- These tables were initially created with organization_id as text, while the
-- canonical organizations.id and fn_user_org_ids() contract are uuid. The
-- preflight deliberately aborts before ALTER TABLE when any persisted value is
-- not a canonical UUID. The actual row population must be checked in Postgres
-- before this migration is applied; static review cannot prove that the cast is
-- safe for existing data.

do $$
declare
  invalid_count bigint;
begin
  select count(*)
    into invalid_count
    from public.asset_license_records
   where organization_id is null
      or organization_id <> btrim(organization_id)
      or organization_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

  if invalid_count > 0 then
    raise exception
      'asset_license_records.organization_id contains % value(s) that cannot be safely cast to uuid',
      invalid_count
      using errcode = 'check_violation';
  end if;

  select count(*)
    into invalid_count
    from public.browsermesh_event_idempotency
   where organization_id is null
      or organization_id <> btrim(organization_id)
      or organization_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

  if invalid_count > 0 then
    raise exception
      'browsermesh_event_idempotency.organization_id contains % value(s) that cannot be safely cast to uuid',
      invalid_count
      using errcode = 'check_violation';
  end if;
end
$$;

alter table public.asset_license_records
  alter column organization_id type uuid
  using organization_id::uuid;

alter table public.browsermesh_event_idempotency
  alter column organization_id type uuid
  using organization_id::uuid;
