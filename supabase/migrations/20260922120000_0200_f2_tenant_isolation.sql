-- F2: tenant isolation runtime roles, identity resolution and RLS probe.
-- Expand-only. No existing data is changed.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'worker_runtime') then
    create role worker_runtime nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'migration_admin') then
    create role migration_admin nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'platform_admin_runtime') then
    create role platform_admin_runtime nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
end
$$;

alter role app_runtime nobypassrls;
alter role worker_runtime nobypassrls;
alter role migration_admin nobypassrls;
alter role platform_admin_runtime nobypassrls;

create table if not exists public.identity_user_mappings (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  user_id uuid not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint identity_user_mappings_active_retired_check check (active or retired_at is not null)
);

create table if not exists public.tenant_access_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid not null,
  request_id text not null,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.f2_tenant_isolation_probe (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  label text not null,
  created_at timestamptz not null default now()
);

alter table public.identity_user_mappings enable row level security;
alter table public.tenant_access_audit enable row level security;
alter table public.f2_tenant_isolation_probe enable row level security;

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
   limit 1
$$;
revoke execute on function public.resolve_firebase_identity(text) from public, anon;
grant execute on function public.resolve_firebase_identity(text) to app_runtime, worker_runtime, platform_admin_runtime;

create or replace function public.record_platform_admin_tenant_access(
  p_organization_id uuid,
  p_request_id text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := nullif(current_setting('app.user_id', true), '')::uuid;
  v_audit_id uuid;
begin
  if current_setting('app.is_platform_admin', true) <> 'true' then
    raise exception 'platform admin context required';
  end if;
  insert into public.tenant_access_audit(user_id, organization_id, request_id, action)
  values (v_user_id, p_organization_id, p_request_id, 'platform_admin.tenant_access')
  returning id into v_audit_id;
  return v_audit_id;
end
$$;
revoke execute on function public.record_platform_admin_tenant_access(uuid, text) from public, anon;
grant execute on function public.record_platform_admin_tenant_access(uuid, text) to platform_admin_runtime;

do $$
declare
  role_name text;
begin
  foreach role_name in array array['app_runtime', 'worker_runtime', 'platform_admin_runtime'] loop
    execute format('drop policy if exists f2_%s_select on public.f2_tenant_isolation_probe', role_name);
    execute format('drop policy if exists f2_%s_insert on public.f2_tenant_isolation_probe', role_name);
    execute format('drop policy if exists f2_%s_update on public.f2_tenant_isolation_probe', role_name);
    execute format('drop policy if exists f2_%s_delete on public.f2_tenant_isolation_probe', role_name);
    execute format($policy$
      create policy f2_%1$s_select on public.f2_tenant_isolation_probe for select to %1$s
      using (organization_id::text = current_setting('app.organization_id', true))
    $policy$, role_name);
    execute format($policy$
      create policy f2_%1$s_insert on public.f2_tenant_isolation_probe for insert to %1$s
      with check (organization_id::text = current_setting('app.organization_id', true))
    $policy$, role_name);
    execute format($policy$
      create policy f2_%1$s_update on public.f2_tenant_isolation_probe for update to %1$s
      using (organization_id::text = current_setting('app.organization_id', true))
      with check (organization_id::text = current_setting('app.organization_id', true))
    $policy$, role_name);
    execute format($policy$
      create policy f2_%1$s_delete on public.f2_tenant_isolation_probe for delete to %1$s
      using (organization_id::text = current_setting('app.organization_id', true))
    $policy$, role_name);
  end loop;
end
$$;

revoke all on table public.f2_tenant_isolation_probe from public, anon, authenticated;
grant select, insert, update, delete on public.f2_tenant_isolation_probe to app_runtime, worker_runtime, platform_admin_runtime;
revoke all on table public.identity_user_mappings from public, anon, authenticated, app_runtime, worker_runtime, platform_admin_runtime;
-- platform_admin_runtime writes audit only through the SECURITY DEFINER function above.
-- No direct table grant: prevents arbitrary audit-row mutation.
revoke all on table public.tenant_access_audit from public, anon, authenticated, app_runtime, worker_runtime, platform_admin_runtime;

comment on table public.f2_tenant_isolation_probe is 'Empty verification fixture for F2 app-filter and native RLS parity; no production data.';
