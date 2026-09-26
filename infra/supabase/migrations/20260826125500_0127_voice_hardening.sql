-- Voice hardening before external provider adapters are connected.
-- Keep provider vocabulary closed and store only normalized scalar event attributes.

alter table public.voice_calls
  drop constraint if exists voice_calls_provider_check;

alter table public.voice_calls
  add constraint voice_calls_provider_check
  check (provider in ('telnyx'));

alter table public.voice_call_events
  drop constraint if exists voice_call_events_provider_check;

alter table public.voice_call_events
  add constraint voice_call_events_provider_check
  check (provider in ('telnyx'));

-- The voice core is not a raw webhook archive. Provider adapters must project
-- only operational fields needed for idempotency, correlation and debugging.
alter table public.voice_call_events
  rename column payload to attributes;

alter table public.voice_call_events
  add constraint voice_call_events_attributes_object_check
  check (jsonb_typeof(attributes) = 'object');

comment on column public.voice_call_events.attributes is
  'Normalized scalar provider event attributes only; never raw webhook payloads, audio, transcripts or secrets.';
