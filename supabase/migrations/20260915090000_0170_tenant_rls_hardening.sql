-- Tenant boundary hardening for the recent billing, Hermes, Studio and
-- BrowserMesh tables. All user-facing access is fail-closed under RLS.

alter table if exists public.organization_plan enable row level security;
alter table if exists public.entitlement_events enable row level security;
alter table if exists public.hermes_session_supersession enable row level security;
alter table if exists public.studio_client_decisions enable row level security;
alter table if exists public.browsermesh_event_idempotency enable row level security;

drop policy if exists organization_plan_tenant_all on public.organization_plan;
create policy organization_plan_tenant_all on public.organization_plan
  for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

drop policy if exists entitlement_events_tenant_all on public.entitlement_events;
create policy entitlement_events_tenant_all on public.entitlement_events
  for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

drop policy if exists hermes_session_supersession_tenant_all on public.hermes_session_supersession;
create policy hermes_session_supersession_tenant_all on public.hermes_session_supersession
  for all to authenticated
  using (organization_id::uuid in (select public.fn_user_org_ids()))
  with check (organization_id::uuid in (select public.fn_user_org_ids()));

drop policy if exists studio_client_decisions_tenant_all on public.studio_client_decisions;
create policy studio_client_decisions_tenant_all on public.studio_client_decisions
  for all to authenticated
  using (organization_id::uuid in (select public.fn_user_org_ids()))
  with check (organization_id::uuid in (select public.fn_user_org_ids()));

drop policy if exists browsermesh_event_idempotency_tenant_all on public.browsermesh_event_idempotency;
create policy browsermesh_event_idempotency_tenant_all on public.browsermesh_event_idempotency
  for all to authenticated
  using (organization_id::uuid in (select public.fn_user_org_ids()))
  with check (organization_id::uuid in (select public.fn_user_org_ids()));

-- The Hermes lock table predates tenant hardening and stores tenant_id as text.
-- UUID-backed production tenants are compared explicitly; non-UUID legacy rows
-- remain inaccessible to authenticated users instead of raising from policy.
drop policy if exists hermes_tool_loop_locks_tenant_all on public.hermes_tool_loop_locks;
create policy hermes_tool_loop_locks_tenant_all on public.hermes_tool_loop_locks
  for all to authenticated
  using (tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and tenant_id::uuid in (select public.fn_user_org_ids()))
  with check (tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and tenant_id::uuid in (select public.fn_user_org_ids()));

revoke all on public.organization_plan from anon;
revoke all on public.entitlement_events from anon;
revoke all on public.hermes_session_supersession from anon;
revoke all on public.studio_client_decisions from anon;
revoke all on public.browsermesh_event_idempotency from anon;
revoke all on public.hermes_tool_loop_locks from anon;
grant select, insert, update, delete on public.organization_plan, public.entitlement_events,
  public.hermes_session_supersession, public.studio_client_decisions,
  public.browsermesh_event_idempotency, public.hermes_tool_loop_locks to authenticated;
grant all on public.organization_plan, public.entitlement_events,
  public.hermes_session_supersession, public.studio_client_decisions,
  public.browsermesh_event_idempotency, public.hermes_tool_loop_locks to service_role;
