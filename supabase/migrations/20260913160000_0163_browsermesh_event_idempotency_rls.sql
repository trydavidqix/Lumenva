-- Wave 4: replay claims are tenant data and must fail closed under RLS.
alter table public.browsermesh_event_idempotency enable row level security;
drop policy if exists browsermesh_event_idempotency_tenant_all on public.browsermesh_event_idempotency;
create policy browsermesh_event_idempotency_tenant_all on public.browsermesh_event_idempotency
  for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));
grant select, insert on public.browsermesh_event_idempotency to authenticated;
grant all on public.browsermesh_event_idempotency to service_role;
