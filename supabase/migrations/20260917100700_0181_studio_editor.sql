create table if not exists public.studio_canvas_documents (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id text not null check (btrim(session_id) <> ''), canvas_id text not null check (btrim(canvas_id) <> ''),
  project_id text not null check (btrim(project_id) <> ''), version integer not null check (version > 0), parent_version integer,
  viewport jsonb not null, layers jsonb not null, selected_variant_id text,
  editor_state text not null check (editor_state in ('DRAFT','IN_REVIEW','APPROVED','SUPERSEDED')),
  source_refs jsonb not null default '[]'::jsonb, evidence_refs jsonb not null default '[]'::jsonb,
  created_by text not null check (btrim(created_by) <> ''), created_at timestamptz not null default now(),
  contract_version text not null default 'wave7-v1', unique (organization_id, session_id, canvas_id, version)
);
create table if not exists public.studio_edit_proposals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id text not null, edit_id text not null, project_id text not null, canvas_id text not null,
  base_version integer not null, context_pack_id text not null, instruction text not null, target_layer_ids jsonb not null,
  patch jsonb not null default '{}'::jsonb, permission_level text not null, risk_level text not null,
  idempotency_key text not null, status text not null default 'PENDING_REVIEW', eval_refs jsonb not null default '[]'::jsonb,
  approved_by text, approved_at timestamptz, created_at timestamptz not null default now(), contract_version text not null default 'wave7-v1',
  unique (organization_id, session_id, edit_id), unique (organization_id, session_id, idempotency_key)
);
create table if not exists public.studio_variant_mixes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id text not null, mix_id text not null, project_id text not null, input_variant_ids jsonb not null,
  output_canvas_id text not null, mix_rules jsonb not null default '[]'::jsonb, context_pack_id text not null,
  status text not null default 'DRAFT', source_refs jsonb not null default '[]'::jsonb, evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), unique (organization_id, session_id, mix_id)
);
create table if not exists public.studio_editor_evals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id text not null, eval_id text not null, canvas_id text not null, input_version integer not null,
  eval_version text not null, checks jsonb not null, metrics jsonb not null, status text not null,
  evidence_refs jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), unique (organization_id, session_id, eval_id)
);
alter table public.studio_canvas_documents enable row level security;
alter table public.studio_edit_proposals enable row level security;
alter table public.studio_variant_mixes enable row level security;
alter table public.studio_editor_evals enable row level security;
do $$ declare table_name text; begin foreach table_name in array array['studio_canvas_documents','studio_edit_proposals','studio_variant_mixes','studio_editor_evals'] loop
  execute format('drop policy if exists %I_tenant_all on public.%I', table_name, table_name);
  execute format('create policy %I_tenant_all on public.%I for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()))', table_name || '_tenant_all', table_name);
end loop; end $$;
grant select, insert, update on public.studio_canvas_documents to authenticated;
grant select, insert, update on public.studio_edit_proposals to authenticated;
grant select, insert, update on public.studio_variant_mixes to authenticated;
grant select, insert on public.studio_editor_evals to authenticated;
grant all on public.studio_canvas_documents, public.studio_edit_proposals, public.studio_variant_mixes, public.studio_editor_evals to service_role;
notify pgrst, 'reload schema';
