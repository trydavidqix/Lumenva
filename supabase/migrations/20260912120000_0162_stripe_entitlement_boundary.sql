-- Stripe billing boundary: additive provider linkage on the canonical
-- entitlement tables created by migration 0161.
-- Existing rows are preserved; this migration performs no DROP/RENAME/update.

alter table if exists public.organization_plan
  add column if not exists effective_at timestamptz not null default now(),
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists provider_event_id text;

alter table if exists public.entitlement_events
  add column if not exists provider_event_id text,
  add column if not exists provider_customer_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists plan_code text,
  add column if not exists status text,
  add column if not exists effective_at timestamptz;

create unique index if not exists entitlement_events_org_provider_event_uidx
  on public.entitlement_events (organization_id, provider_event_id)
  where provider_event_id is not null;

create index if not exists entitlement_events_org_effective_idx
  on public.entitlement_events (organization_id, effective_at desc);
