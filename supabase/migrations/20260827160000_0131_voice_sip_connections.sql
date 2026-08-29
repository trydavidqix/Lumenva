-- Fase 2 (plano SIP/BYOC): o cliente mantém o próprio número e operadora.
-- A organização deixa de ser resolvida por um número técnico comprado pela
-- plataforma e passa a ser resolvida por uma conexão SIP/BYOC verificada.
-- Aditivo e reversível: voice_phone_numbers/voice_worker_endpoints continuam
-- funcionando pelo caminho antigo (número técnico Telnyx) para rollback.

create table if not exists public.voice_sip_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  gateway text not null check (gateway in ('asterisk', 'telnyx')),
  external_connection_id text not null,
  verified boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gateway, external_connection_id)
);

create index if not exists voice_sip_connections_org_idx
  on public.voice_sip_connections (organization_id, enabled);

alter table public.voice_sip_connections enable row level security;

create policy voice_sip_connections_select_org on public.voice_sip_connections
for select to authenticated
using (organization_id in (select public.fn_user_org_ids()));

create policy voice_sip_connections_insert_org on public.voice_sip_connections
for insert to authenticated
with check (organization_id in (select public.fn_user_org_ids()));

create policy voice_sip_connections_update_org on public.voice_sip_connections
for update to authenticated
using (organization_id in (select public.fn_user_org_ids()))
with check (organization_id in (select public.fn_user_org_ids()));

create policy voice_sip_connections_delete_org on public.voice_sip_connections
for delete to authenticated
using (organization_id in (select public.fn_user_org_ids()));

comment on table public.voice_sip_connections is
  'SIP/BYOC connections the customer authorizes. A number in voice_phone_numbers only resolves an organization once its connection here is verified and enabled — an unknown or unverified connection never leaks tenant identity.';

-- The customer's own number now optionally hangs off a verified connection
-- instead of always being a number the platform purchased from Telnyx.
alter table public.voice_phone_numbers
  add column if not exists connection_id uuid references public.voice_sip_connections(id) on delete cascade,
  add column if not exists ownership_verified_at timestamptz;

alter table public.voice_phone_numbers
  drop constraint if exists voice_phone_numbers_provider_check;
alter table public.voice_phone_numbers
  add constraint voice_phone_numbers_provider_check check (provider in ('telnyx', 'asterisk'));

create index if not exists voice_phone_numbers_connection_idx
  on public.voice_phone_numbers (connection_id);

-- "Um worker por número técnico" deixa de ser regra: o worker liga-se à
-- conexão e resolve o número por chamada. voice_phone_number_id vira
-- opcional (mantido para o caminho de rollback Telnyx) e connection_id é o
-- novo caminho SIP/BYOC.
alter table public.voice_worker_endpoints
  alter column voice_phone_number_id drop not null;

alter table public.voice_worker_endpoints
  add column if not exists connection_id uuid references public.voice_sip_connections(id) on delete cascade;

alter table public.voice_worker_endpoints
  drop constraint if exists voice_worker_endpoints_voice_phone_number_id_key;

create unique index if not exists voice_worker_endpoints_phone_number_key
  on public.voice_worker_endpoints (voice_phone_number_id)
  where voice_phone_number_id is not null;

create unique index if not exists voice_worker_endpoints_connection_key
  on public.voice_worker_endpoints (connection_id)
  where connection_id is not null;

alter table public.voice_worker_endpoints
  drop constraint if exists voice_worker_endpoints_binding_check;
alter table public.voice_worker_endpoints
  add constraint voice_worker_endpoints_binding_check
    check (voice_phone_number_id is not null or connection_id is not null);

comment on table public.voice_worker_endpoints is
  'Service-only routing to a private Lumenva voice-worker control endpoint. No authenticated tenant policies by design. voice_phone_number_id is the legacy Telnyx-purchased-number path kept for rollback; connection_id is the SIP/BYOC path — a worker binds to at most one of each, never zero.';
