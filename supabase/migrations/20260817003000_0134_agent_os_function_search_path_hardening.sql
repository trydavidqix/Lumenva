-- Agent OS Phase 1.2 — narrow search_path hardening.
--
-- This migration intentionally changes ONLY function-level search_path settings
-- for the two agent-version immutability trigger functions flagged by Supabase
-- advisors. It does not recreate function bodies, change ownership, alter grants,
-- or modify trigger bindings.
--
-- Production application remains behind the owner approval gate.

alter function public.fn_agent_versions_immutable()
  set search_path = pg_catalog, public;

alter function public.fn_ai_agent_version_content_immutable()
  set search_path = pg_catalog, public;
