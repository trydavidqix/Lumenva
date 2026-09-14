create table if not exists public.browsermesh_event_idempotency (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  event_id text not null,
  idempotency_key text not null,
  status text not null check (status in ('CLAIMED')),
  claimed_at timestamptz not null default now(),
  constraint browsermesh_event_idempotency_org_key unique (organization_id, idempotency_key),
  constraint browsermesh_event_idempotency_event_key unique (organization_id, event_id)
);
