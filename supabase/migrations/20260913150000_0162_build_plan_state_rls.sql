-- Wave 9/10: tenant isolation for durable build-plan repair state.
alter table public.build_plan_state enable row level security;
drop policy if exists build_plan_state_tenant_all on public.build_plan_state;
create policy build_plan_state_tenant_all on public.build_plan_state
  for all to authenticated
  using (tenant_id in (select public.fn_user_org_ids()))
  with check (tenant_id in (select public.fn_user_org_ids()));
grant select, insert, update on public.build_plan_state to authenticated;
grant all on public.build_plan_state to service_role;
