-- Corrective migration for 0170: restore least-privilege entitlement writes.
-- Policies are OR-combined by Postgres, so broad tenant-all policies cannot
-- coexist with the platform-only/append-only policies from 0161.

drop policy if exists organization_plan_tenant_all on public.organization_plan;
drop policy if exists organization_plan_select on public.organization_plan;
drop policy if exists organization_plan_platform_write on public.organization_plan;
create policy organization_plan_select on public.organization_plan
  for select to authenticated
  using (organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin());
create policy organization_plan_platform_write on public.organization_plan
  for all to authenticated
  using (public.fn_is_platform_admin())
  with check (public.fn_is_platform_admin());

drop policy if exists entitlement_events_tenant_all on public.entitlement_events;
drop policy if exists entitlement_events_select on public.entitlement_events;
drop policy if exists entitlement_events_insert on public.entitlement_events;
create policy entitlement_events_select on public.entitlement_events
  for select to authenticated
  using (organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin());
create policy entitlement_events_insert on public.entitlement_events
  for insert to authenticated
  with check (organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin());

revoke all on public.organization_plan, public.entitlement_events from anon;
grant select, insert, update, delete on public.organization_plan to authenticated;
grant select, insert, update, delete on public.entitlement_events to authenticated;
grant all on public.organization_plan, public.entitlement_events to service_role;
