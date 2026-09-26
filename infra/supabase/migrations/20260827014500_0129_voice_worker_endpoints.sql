create table if not exists public.voice_worker_endpoints (
  id uuid primary key default gen_random_uuid(),
  voice_phone_number_id uuid not null unique references public.voice_phone_numbers(id) on delete cascade,
  control_url text not null check (control_url ~ '^https://[^[:space:]]+$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voice_worker_endpoints enable row level security;

comment on table public.voice_worker_endpoints is
  'Service-only routing from a technical Telnyx number to its private Lumenva voice-worker control endpoint. No authenticated tenant policies by design.';
