-- Forward-fix: tenant isolation for Wave 10 durable delivery state.
alter table public.build_plan_state enable row level security;
drop policy if exists build_plan_state_tenant_isolation on public.build_plan_state;
create policy build_plan_state_tenant_isolation on public.build_plan_state
  for all to authenticated
  using (tenant_id = current_setting('app.tenant_id', true))
  with check (tenant_id = current_setting('app.tenant_id', true));
