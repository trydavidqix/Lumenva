-- 0133_voice_calls_provider_asterisk
-- Forward-fix: 0131_voice_sip_connections ampliou voice_phone_numbers_provider_check
-- pra incluir 'asterisk', mas deixou voice_calls_provider_check e
-- voice_call_events_provider_check (fechados em 0127_voice_hardening) só com
-- 'telnyx'. Achado ao vivo em 2026-08-30: /api/internal/voice/context insere em
-- voice_calls com provider='asterisk' e a constraint rejeitava com erro cru de
-- Postgres (sem prefixo "[voice]"), que a rota sanitiza pra mensagem genérica —
-- por isso a ligação real ficava sem áudio sem nenhum log óbvio do motivo.
alter table public.voice_calls
  drop constraint if exists voice_calls_provider_check;
alter table public.voice_calls
  add constraint voice_calls_provider_check
  check (provider in ('telnyx', 'asterisk'));

alter table public.voice_call_events
  drop constraint if exists voice_call_events_provider_check;
alter table public.voice_call_events
  add constraint voice_call_events_provider_check
  check (provider in ('telnyx', 'asterisk'));
