-- The worker control URL is infrastructure metadata, not tenant data.
-- RLS already has no authenticated policies; revoke explicit grants as defense in depth.
revoke all on table public.voice_worker_endpoints from anon;
revoke all on table public.voice_worker_endpoints from authenticated;

comment on table public.voice_worker_endpoints is
  'Service-only routing from a technical Telnyx number to its private Lumenva voice-worker control endpoint. Explicitly unavailable to anon/authenticated roles.';
