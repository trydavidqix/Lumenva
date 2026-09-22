-- F1 identity mapping forward-fix on top of F2's canonical mapping table.
-- F2 owns identity_user_mappings(firebase_uid -> user_id); this migration adds
-- migration-only candidate/backfill infrastructure without weakening that
-- runtime contract.

create extension if not exists citext;

alter table public.identity_user_mappings
  add column if not exists email_snapshot citext;
alter table public.identity_user_mappings
  add column if not exists updated_at timestamptz not null default now();
alter table public.identity_user_mappings
  add column if not exists migrated_at timestamptz;

create unique index if not exists identity_user_mappings_user_id_key
  on public.identity_user_mappings (user_id);

comment on column public.identity_user_mappings.user_id is
  'Internal/legacy auth UUID resolved from Firebase UID; the canonical F2 identity target.';
comment on column public.identity_user_mappings.email_snapshot is
  'Operational snapshot only; never an authorization source.';

create or replace function public.fn_identity_user_mapping_immutable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.firebase_uid is distinct from old.firebase_uid
     or new.user_id is distinct from old.user_id then
    raise exception 'identity mapping keys are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists identity_user_mapping_keys_immutable on public.identity_user_mappings;
create trigger identity_user_mapping_keys_immutable
before update on public.identity_user_mappings
for each row execute function public.fn_identity_user_mapping_immutable();

revoke execute on function public.fn_identity_user_mapping_immutable()
  from public, anon, authenticated, service_role, app_runtime, worker_runtime, platform_admin_runtime;
grant execute on function public.fn_identity_user_mapping_immutable() to migration_admin;

create table if not exists public.identity_user_mapping_candidates (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,
  proposed_user_id uuid,
  email_snapshot citext,
  status text not null default 'pending'
    check (status in ('pending', 'blocked', 'resolved', 'retired')),
  collision_code text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint identity_user_mapping_candidates_firebase_uid_key unique (firebase_uid)
);

create index if not exists identity_user_mapping_candidates_status_idx
  on public.identity_user_mapping_candidates (status, created_at);

create table if not exists public.identity_user_mapping_audit (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  mapping_id uuid references public.identity_user_mappings(id) on delete set null,
  candidate_id uuid references public.identity_user_mapping_candidates(id) on delete set null,
  firebase_uid text not null,
  action text not null
    check (action in ('created', 'unchanged', 'candidate_created', 'collision')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint identity_user_mapping_audit_run_identity_key
    unique (run_id, firebase_uid, action)
);

create index if not exists identity_user_mapping_audit_firebase_uid_idx
  on public.identity_user_mapping_audit (firebase_uid, created_at desc);

create or replace function public.fn_identity_user_mapping_audit_immutable()
returns trigger
language plpgsql
security definer
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
  constraint identity_migration_flags_known_flag
    check (flag_name in ('firebase_dual_read'))
);

insert into public.identity_migration_flags (flag_name, enabled)
values ('firebase_dual_read', false)
on conflict (flag_name) do nothing;

alter table public.identity_user_mapping_candidates enable row level security;
alter table public.identity_user_mapping_audit enable row level security;
alter table public.identity_migration_flags enable row level security;

drop policy if exists identity_user_mapping_candidates_migration_select
  on public.identity_user_mapping_candidates;
create policy identity_user_mapping_candidates_migration_select
  on public.identity_user_mapping_candidates
  for select to migration_admin
  using (true);

drop policy if exists identity_user_mapping_audit_migration_select
  on public.identity_user_mapping_audit;
create policy identity_user_mapping_audit_migration_select
  on public.identity_user_mapping_audit
  for select to migration_admin
  using (true);

drop policy if exists identity_migration_flags_migration_select
  on public.identity_migration_flags;
create policy identity_migration_flags_migration_select
  on public.identity_migration_flags
  for select to migration_admin
  using (true);

revoke all on table public.identity_user_mapping_candidates
  from public, anon, authenticated, service_role, app_runtime, worker_runtime, platform_admin_runtime;
revoke all on table public.identity_user_mapping_audit
  from public, anon, authenticated, service_role, app_runtime, worker_runtime, platform_admin_runtime;
revoke all on table public.identity_migration_flags
  from public, anon, authenticated, service_role, app_runtime, worker_runtime, platform_admin_runtime;
grant select on table public.identity_user_mapping_candidates to migration_admin;
grant select on table public.identity_user_mapping_audit to migration_admin;
grant select on table public.identity_migration_flags to migration_admin;

create or replace function public.resolve_firebase_identity(p_firebase_uid text)
returns uuid
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select user_id
    from public.identity_user_mappings
   where firebase_uid = p_firebase_uid
     and active
     and retired_at is null
   limit 1
$$;

revoke execute on function public.resolve_firebase_identity(text)
  from public, anon, authenticated;
grant execute on function public.resolve_firebase_identity(text)
  to app_runtime, worker_runtime, platform_admin_runtime;

create or replace function public.fn_firebase_dual_read_enabled()
returns boolean
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select coalesce(
    (select enabled from public.identity_migration_flags where flag_name = 'firebase_dual_read'),
    false
  );
$$;

revoke execute on function public.fn_firebase_dual_read_enabled()
  from public, anon, authenticated, service_role;
grant execute on function public.fn_firebase_dual_read_enabled()
  to app_runtime, worker_runtime, migration_admin, platform_admin_runtime;

create or replace function public.backfill_identity_user_mappings(
  p_identities jsonb,
  p_run_id uuid,
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
  proposed_user_id_value uuid;
  email_value citext;
  match_status_value text;
  collision_value text;
  existing_mapping_id uuid;
  existing_user_id uuid;
  candidate_id_value uuid;
  action_value text;
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
  if p_run_id is null then
    raise exception 'p_run_id is required';
  end if;
  if jsonb_typeof(p_identities) <> 'array' then
    raise exception 'p_identities must be a JSON array';
  end if;

  for item in select value from jsonb_array_elements(p_identities) loop
    total_value := total_value + 1;
    firebase_uid_value := nullif(item->>'firebase_uid', '');
    email_value := nullif(item->>'email_snapshot', '');
    match_status_value := coalesce(item->>'match_status', 'pending');
    collision_value := nullif(item->>'collision', '');
    proposed_user_id_value := coalesce(
      nullif(item->>'user_id', ''),
      nullif(item->>'legacy_auth_user_id', '')
    )::uuid;

    if firebase_uid_value is null then
      raise exception 'firebase_uid is required for every identity';
    end if;

    if match_status_value = 'matched'
       and proposed_user_id_value is not null
       and collision_value is null then
      matched_value := matched_value + 1;
    else
      pending_value := pending_value + 1;
    end if;

    if collision_value = 'duplicate_firebase_uid' then
      duplicate_firebase_value := duplicate_firebase_value + 1;
    elsif collision_value = 'duplicate_legacy_auth_user_id' then
      duplicate_legacy_value := duplicate_legacy_value + 1;
    elsif collision_value = 'email_collision' then
      email_collision_value := email_collision_value + 1;
    elsif collision_value = 'deleted_user' then
      deleted_user_value := deleted_user_value + 1;
    elsif collision_value = 'missing_membership' then
      missing_membership_value := missing_membership_value + 1;
    end if;

    if p_dry_run then
      continue;
    end if;

    existing_mapping_id := null;
    existing_user_id := null;
    select id, user_id
      into existing_mapping_id, existing_user_id
      from public.identity_user_mappings
     where firebase_uid = firebase_uid_value;

    if match_status_value = 'matched'
       and proposed_user_id_value is not null
       and collision_value is null
       and (existing_mapping_id is null or existing_user_id = proposed_user_id_value) then
      if existing_mapping_id is null then
        insert into public.identity_user_mappings
          (firebase_uid, user_id, active, email_snapshot, updated_at, migrated_at)
        values
          (firebase_uid_value, proposed_user_id_value, true, email_value, now(), now())
        returning id into existing_mapping_id;
        action_value := 'created';
      else
        update public.identity_user_mappings
           set email_snapshot = coalesce(email_value, email_snapshot),
               updated_at = now(),
               migrated_at = coalesce(migrated_at, now())
         where id = existing_mapping_id;
        action_value := 'unchanged';
      end if;
      update public.identity_user_mapping_candidates
         set status = 'resolved', resolved_at = now(), updated_at = now()
       where firebase_uid = firebase_uid_value;
      persisted_value := persisted_value + 1;
      insert into public.identity_user_mapping_audit
        (run_id, mapping_id, firebase_uid, action, details)
      values
        (p_run_id, existing_mapping_id, firebase_uid_value, action_value,
         jsonb_build_object('source', 'backfill'))
      on conflict (run_id, firebase_uid, action) do nothing;
    else
      if existing_mapping_id is not null
         and proposed_user_id_value is not null
         and existing_user_id is distinct from proposed_user_id_value then
        duplicate_firebase_value := duplicate_firebase_value + 1;
        collision_value := coalesce(collision_value, 'duplicate_firebase_uid');
      end if;

      insert into public.identity_user_mapping_candidates
        (firebase_uid, proposed_user_id, email_snapshot, status, collision_code, details, updated_at)
      values
        (firebase_uid_value, proposed_user_id_value, email_value,
         case when collision_value is null then 'pending' else 'blocked' end,
         collision_value, jsonb_build_object('source', 'backfill'), now())
      on conflict (firebase_uid) do update set
        proposed_user_id = excluded.proposed_user_id,
        email_snapshot = coalesce(excluded.email_snapshot, identity_user_mapping_candidates.email_snapshot),
        status = excluded.status,
        collision_code = excluded.collision_code,
        details = excluded.details,
        updated_at = now()
      returning id into candidate_id_value;
      action_value := case when collision_value is null then 'candidate_created' else 'collision' end;
      persisted_value := persisted_value + 1;
      insert into public.identity_user_mapping_audit
        (run_id, candidate_id, firebase_uid, action, details)
      values
        (p_run_id, candidate_id_value, firebase_uid_value, action_value,
         jsonb_build_object('source', 'backfill', 'collision', collision_value))
      on conflict (run_id, firebase_uid, action) do nothing;
    end if;
  end loop;

  return query
    select total_value, matched_value, pending_value, duplicate_firebase_value,
      duplicate_legacy_value, email_collision_value, deleted_user_value,
      missing_membership_value, persisted_value;
end;
$$;

revoke execute on function public.backfill_identity_user_mappings(jsonb, uuid, boolean)
  from public, anon, authenticated, service_role, app_runtime, worker_runtime, platform_admin_runtime;
grant execute on function public.backfill_identity_user_mappings(jsonb, uuid, boolean)
  to migration_admin;
