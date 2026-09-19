alter table public.hermes_tool_loop_locks add column if not exists tenant_id text;
update public.hermes_tool_loop_locks set tenant_id = 'legacy' where tenant_id is null;
alter table public.hermes_tool_loop_locks alter column tenant_id set not null;
create unique index if not exists hermes_tool_loop_locks_tenant_lock_key on public.hermes_tool_loop_locks (tenant_id, lock_id);
alter table public.hermes_tool_loop_locks enable row level security;
drop policy if exists hermes_tool_loop_locks_tenant_all on public.hermes_tool_loop_locks;
create policy hermes_tool_loop_locks_tenant_all on public.hermes_tool_loop_locks
  for all using (tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and tenant_id::uuid in (select public.fn_user_org_ids()))
  with check (tenant_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and tenant_id::uuid in (select public.fn_user_org_ids()));
grant select, insert, update, delete on public.hermes_tool_loop_locks to authenticated;
