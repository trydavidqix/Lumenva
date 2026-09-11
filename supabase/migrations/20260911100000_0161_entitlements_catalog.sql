-- Entitlements catalog and tenant assignments (Phase 1).
-- Catalog rows are global; tenant state and events are protected by organization RLS.

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name text not null, description text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(), slug text not null unique,
  name text not null, description text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.plan_modules (
  plan_id uuid not null references public.plans(id) on delete cascade,
  module_id uuid not null references public.modules(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (plan_id, module_id)
);
create table if not exists public.organization_plan (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null default 'active' check (status in ('active', 'scheduled', 'cancelled')),
  effective_at timestamptz not null default now(), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.entitlement_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null check (event_type in ('plan_assigned', 'plan_changed', 'plan_cancelled', 'module_granted', 'module_revoked')),
  plan_id uuid references public.plans(id), module_id uuid references public.modules(id),
  idempotency_key text not null, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique (organization_id, idempotency_key)
);
create index if not exists organization_plan_plan_idx on public.organization_plan (plan_id);
create index if not exists entitlement_events_org_created_idx on public.entitlement_events (organization_id, created_at desc);

alter table public.plans enable row level security;
alter table public.modules enable row level security;
alter table public.plan_modules enable row level security;
alter table public.organization_plan enable row level security;
alter table public.entitlement_events enable row level security;

drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans for select to authenticated using (is_active or public.fn_is_platform_admin());
drop policy if exists modules_select on public.modules;
create policy modules_select on public.modules for select to authenticated using (is_active or public.fn_is_platform_admin());
drop policy if exists plan_modules_select on public.plan_modules;
create policy plan_modules_select on public.plan_modules for select to authenticated using (exists (select 1 from public.organization_plan op where op.plan_id = plan_modules.plan_id and op.organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin());
drop policy if exists organization_plan_select on public.organization_plan;
create policy organization_plan_select on public.organization_plan for select to authenticated using (organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin());
drop policy if exists organization_plan_platform_write on public.organization_plan;
create policy organization_plan_platform_write on public.organization_plan for all to authenticated using (public.fn_is_platform_admin()) with check (public.fn_is_platform_admin());
drop policy if exists entitlement_events_select on public.entitlement_events;
create policy entitlement_events_select on public.entitlement_events for select to authenticated using (organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin());
drop policy if exists entitlement_events_insert on public.entitlement_events;
create policy entitlement_events_insert on public.entitlement_events for insert to authenticated with check (organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin());

insert into public.plans (slug, name, description) values ('premium', 'Premium', 'Plano Premium para fixtures e ambientes de teste')
on conflict (slug) do update set name = excluded.name, description = excluded.description, is_active = true, updated_at = now();
insert into public.modules (slug, name, description) values
  ('contacts', 'Contacts', 'Customer 360 contacts'), ('agents', 'Agents', 'Agent OS execution'),
  ('jobs', 'Jobs', 'Background job execution'), ('audit', 'Audit', 'Tenant audit trail')
on conflict (slug) do update set name = excluded.name, description = excluded.description, is_active = true, updated_at = now();
insert into public.plan_modules (plan_id, module_id)
select p.id, m.id from public.plans p cross join public.modules m
where p.slug = 'premium' and m.slug in ('contacts', 'agents', 'jobs', 'audit') on conflict do nothing;
