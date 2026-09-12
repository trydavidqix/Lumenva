-- Stripe billing boundary: additive entitlement ledger and provider linkage.
-- No provider API calls or catalog mutations are performed here.
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
  status text not null default 'active' check (status in ('active','trialing','past_due','canceled','unpaid','scheduled','cancelled')),
  effective_at timestamptz not null default now(),
  provider_customer_id text,
  provider_subscription_id text,
  provider_event_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.entitlement_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null,
  plan_id uuid references public.plans(id),
  module_id uuid references public.modules(id),
  provider_event_id text not null,
  provider_customer_id text,
  provider_subscription_id text,
  plan_code text,
  status text check (status is null or status in ('active','trialing','past_due','canceled','unpaid')),
  effective_at timestamptz not null,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, provider_event_id)
);
create index if not exists entitlement_events_org_effective_idx on public.entitlement_events (organization_id, effective_at desc);
