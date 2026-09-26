-- Wave 6 Studio Commercial: durable, tenant-scoped client portal tokens.
create table if not exists public.studio_client_portal_tokens (
  token_id uuid primary key,
  project_id text not null check (btrim(project_id) <> ''),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  scope text not null check (scope in ('VIEW','COMMENT','APPROVE','REQUEST_CHANGES')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  single_use boolean not null default false,
  created_by text not null check (btrim(created_by) <> ''),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, token_hash)
);

create index if not exists studio_client_portal_tokens_lookup_idx
  on public.studio_client_portal_tokens (organization_id, project_id, expires_at);

alter table public.studio_client_portal_tokens enable row level security;
drop policy if exists studio_client_portal_tokens_tenant_all on public.studio_client_portal_tokens;
create policy studio_client_portal_tokens_tenant_all
  on public.studio_client_portal_tokens
  for all to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

grant select, insert, update on public.studio_client_portal_tokens to authenticated;
grant all on public.studio_client_portal_tokens to service_role;
notify pgrst, 'reload schema';
