-- Agent OS Phase 1.2 security hardening
--
-- Supabase security advisors flagged mutable search_path on two trigger
-- functions used by agent-version immutability. These functions only use
-- PL/pgSQL trigger variables and pg_catalog built-ins; they do not require
-- application schemas on search_path.
--
-- Safe/reversible preparation only. This migration is committed to the
-- isolated agent-os branch and is NOT applied to production by this change.

alter function public.fn_agent_versions_immutable()
  set search_path = '';

alter function public.fn_ai_agent_version_content_immutable()
  set search_path = '';
