-- 0101 agent_cases: revoke execute/select from public/anon roles
-- Forward-fix for 0066: agent_cases and agent_case_events should not be readable by anon key.
-- Hardening: deny unauthenticated access to case/event data (W7 minors).

revoke all on table agent_cases from public, anon;
revoke all on table agent_case_events from public, anon;
