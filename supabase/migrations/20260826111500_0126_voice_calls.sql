-- Voice core: tenant-scoped call/session persistence.
-- Voice is a channel into the existing Agent OS; this schema stores transport
-- state only and does not create a parallel agent or customer model.

-- contacts.id is globally primary-keyed in the CRM, but the composite foreign
-- key below must also have an exact unique target in PostgreSQL. This index is
-- redundant for lookup purposes and keeps the tenant boundary explicit.
create unique index if not exists contacts_org_id_unique_for_voice_fk
  on public.contacts (organization_id, id);

create table if not exists public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid null,
  agent_id uuid null,
  conversation_id uuid null,
  direction text not null check (direction in ('inbound', 'outbound')),
  caller_number text not null,
  called_number text not null,
  state text not null check (state in ('queued','ringing','connecting','active','held','transferring','completed','failed','canceled')),
  provider text not null,
  provider_call_id text null,
  livekit_room_name text null,
  started_at timestamptz null,
  answered_at timestamptz null,
  ended_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint voice_calls_org_contact_fk
    foreign key (organization_id, contact_id)
    references public.contacts(organization_id, id)
    on delete set null
);

create unique index if not exists voice_calls_provider_call_unique
  on public.voice_calls (organization_id, provider, provider_call_id)
  where provider_call_id is not null;

create index if not exists voice_calls_org_created_idx
  on public.voice_calls (organization_id, created_at desc);

create index if not exists voice_calls_org_contact_idx
  on public.voice_calls (organization_id, contact_id, created_at desc)
  where contact_id is not null;

create table if not exists public.voice_call_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  voice_call_id uuid not null references public.voice_calls(id) on delete cascade,
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, provider, provider_event_id)
);

create index if not exists voice_call_events_call_time_idx
  on public.voice_call_events (organization_id, voice_call_id, occurred_at);

alter table public.voice_calls enable row level security;
alter table public.voice_call_events enable row level security;

-- Authenticated users may read only voice state belonging to organizations they
-- belong to. Mutations are performed by trusted server/service-role paths.
drop policy if exists voice_calls_select_org on public.voice_calls;
create policy voice_calls_select_org
  on public.voice_calls
  for select
  to authenticated
  using (organization_id in (select public.fn_user_org_ids()));

drop policy if exists voice_call_events_select_org on public.voice_call_events;
create policy voice_call_events_select_org
  on public.voice_call_events
  for select
  to authenticated
  using (organization_id in (select public.fn_user_org_ids()));

comment on table public.voice_calls is
  'Tenant-scoped PSTN/realtime voice call state; source of business truth remains CRM/order domains.';
comment on table public.voice_call_events is
  'Append-only provider event ledger for voice calls; provider event ids are idempotent per organization.';
