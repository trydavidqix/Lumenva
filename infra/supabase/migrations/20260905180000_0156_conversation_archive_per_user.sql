-- 0156: arquivamento de conversa por utilizador (aditivo, idempotente)
create table if not exists public.conversation_archives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  archived_at timestamptz not null default now(),
  constraint conversation_archives_user_unique unique (conversation_id, user_id)
);
create index if not exists conversation_archives_user_idx
  on public.conversation_archives (organization_id, user_id, archived_at desc);
alter table public.conversation_archives enable row level security;
drop policy if exists conversation_archives_select on public.conversation_archives;
create policy conversation_archives_select on public.conversation_archives for select to authenticated
  using (user_id = auth.uid() and organization_id in (select public.fn_user_org_ids()));
drop policy if exists conversation_archives_insert on public.conversation_archives;
create policy conversation_archives_insert on public.conversation_archives for insert to authenticated
  with check (user_id = auth.uid() and organization_id in (select public.fn_user_org_ids()));
drop policy if exists conversation_archives_delete on public.conversation_archives;
create policy conversation_archives_delete on public.conversation_archives for delete to authenticated
  using (user_id = auth.uid() and organization_id in (select public.fn_user_org_ids()));
grant select, insert, delete on public.conversation_archives to authenticated;
grant all on public.conversation_archives to service_role;
