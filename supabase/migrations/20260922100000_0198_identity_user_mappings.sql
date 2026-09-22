-- F1 identity mapping infrastructure. Dual-read stays disabled by default.
create extension if not exists citext;

create table if not exists public.identity_user_mappings (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,
  legacy_auth_user_id uuid,
  email_snapshot citext,
  status text not null default 'pending' check (status in ('active', 'pending', 'blocked', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  migrated_at timestamptz,
  constraint identity_user_mappings_firebase_uid_key unique (firebase_uid),
  constraint identity_user_mappings_legacy_auth_user_id_key unique (legacy_auth_user_id)
);

create index if not exists identity_user_mappings_firebase_uid_idx
  on public.identity_user_mappings (firebase_uid);
create index if not exists identity_user_mappings_legacy_auth_user_id_idx
  on public.identity_user_mappings (legacy_auth_user_id);

create table if not exists public.identity_user_mapping_audit (
  id uuid primary key default gen_random_uuid(),
  mapping_id uuid references public.identity_user_mappings(id) on delete set null,
  firebase_uid text not null,
  legacy_auth_user_id uuid,
  action text not null check (action in ('dry_run_matched', 'dry_run_pending', 'created', 'unchanged', 'collision')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists identity_user_mapping_audit_firebase_uid_idx
  on public.identity_user_mapping_audit (firebase_uid, created_at desc);

create or replace function public.fn_identity_user_mapping_audit_immutable()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'identity_user_mapping_audit is append-only';
end;
$$;

drop trigger if exists identity_user_mapping_audit_immutable on public.identity_user_mapping_audit;
create trigger identity_user_mapping_audit_immutable
before update or delete on public.identity_user_mapping_audit
for each row execute function public.fn_identity_user_mapping_audit_immutable();

create table if not exists public.identity_migration_flags (
  flag_name text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint identity_migration_flags_known_flag check (flag_name in ('firebase_dual_read'))
);

insert into public.identity_migration_flags (flag_name, enabled)
values ('firebase_dual_read', false)
on conflict (flag_name) do nothing;

create or replace function public.fn_firebase_dual_read_enabled()
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((select enabled from public.identity_migration_flags where flag_name = 'firebase_dual_read'), false);
$$;

create or replace function public.backfill_identity_user_mappings(
  p_identities jsonb,
  p_dry_run boolean default true
)
returns table (
  total_input bigint,
  matched bigint,
  pending bigint,
  duplicate_firebase_uid bigint,
  duplicate_legacy_auth_user_id bigint,
  email_collision bigint,
  deleted_user bigint,
  missing_membership bigint,
  persisted bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  firebase_uid_value text;
  legacy_auth_user_id_value uuid;
  email_value citext;
  match_status text;
  collision_value text;
  mapping_id_value uuid;
  total_value bigint := 0;
  matched_value bigint := 0;
  pending_value bigint := 0;
  duplicate_firebase_value bigint := 0;
  duplicate_legacy_value bigint := 0;
  email_collision_value bigint := 0;
  deleted_user_value bigint := 0;
  missing_membership_value bigint := 0;
  persisted_value bigint := 0;
begin
  if jsonb_typeof(p_identities) <> 'array' then
    raise exception 'p_identities must be a JSON array';
  end if;

  for item in select value from jsonb_array_elements(p_identities) loop
    total_value := total_value + 1;
    firebase_uid_value := nullif(item->>'firebase_uid', '');
    match_status := coalesce(item->>'match_status', 'pending');
    collision_value := item->>'collision';
    email_value := nullif(item->>'email_snapshot', '');

    if firebase_uid_value is null then
      raise exception 'firebase_uid is required for every identity';
    end if;

    legacy_auth_user_id_value := nullif(item->>'legacy_auth_user_id', '')::uuid;

    if match_status = 'matched' and legacy_auth_user_id_value is not null then
      matched_value := matched_value + 1;
    else
      pending_value := pending_value + 1;
    end if;

    if collision_value = 'duplicate_firebase_uid' then duplicate_firebase_value := duplicate_firebase_value + 1; end if;
    if collision_value = 'duplicate_legacy_auth_user_id' then duplicate_legacy_value := duplicate_legacy_value + 1; end if;
    if collision_value = 'email_collision' then email_collision_value := email_collision_value + 1; end if;
    if collision_value = 'deleted_user' then deleted_user_value := deleted_user_value + 1; end if;
    if collision_value = 'missing_membership' then missing_membership_value := missing_membership_value + 1; end if;

    if p_dry_run then
      continue;
    end if;

    if match_status = 'matched' and legacy_auth_user_id_value is not null and collision_value is null then
      insert into public.identity_user_mappings (firebase_uid, legacy_auth_user_id, email_snapshot, status, migrated_at)
      values (firebase_uid_value, legacy_auth_user_id_value, email_value, 'active', now())
      on conflict (firebase_uid) do update set
        email_snapshot = excluded.email_snapshot,
        updated_at = now()
      returning id into mapping_id_value;
      if mapping_id_value is not null then persisted_value := persisted_value + 1; end if;
      insert into public.identity_user_mapping_audit (mapping_id, firebase_uid, legacy_auth_user_id, action, details)
      values (mapping_id_value, firebase_uid_value, legacy_auth_user_id_value, 'created', jsonb_build_object('source', 'backfill'));
    else
      insert into public.identity_user_mappings (firebase_uid, email_snapshot, status)
      values (firebase_uid_value, email_value, 'pending')
      on conflict (firebase_uid) do update set
        email_snapshot = excluded.email_snapshot,
        updated_at = now()
      returning id into mapping_id_value;
      if mapping_id_value is not null then persisted_value := persisted_value + 1; end if;
      insert into public.identity_user_mapping_audit (mapping_id, firebase_uid, action, details)
      values (mapping_id_value, firebase_uid_value, 'collision', jsonb_build_object('source', 'backfill', 'collision', collision_value));
    end if;
  end loop;

  return query select total_value, matched_value, pending_value, duplicate_firebase_value,
    duplicate_legacy_value, email_collision_value, deleted_user_value, missing_membership_value,
    persisted_value;
end;
$$;

revoke execute on function public.backfill_identity_user_mappings(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.backfill_identity_user_mappings(jsonb, boolean) to service_role;
revoke execute on function public.fn_firebase_dual_read_enabled() from public, anon;
grant execute on function public.fn_firebase_dual_read_enabled() to authenticated, service_role;
revoke update, delete on public.identity_user_mapping_audit from public, anon, authenticated;
