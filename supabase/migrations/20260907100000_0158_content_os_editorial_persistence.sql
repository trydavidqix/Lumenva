-- Content OS V1 editorial persistence.
-- Research is evidence-first: external providers remain references and all
-- state needed to resume, audit, and publish lives in Postgres.

create table if not exists public.content_research_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_id uuid references public.content_opportunities(id) on delete set null,
  content_item_id uuid references public.content_items(id) on delete set null,
  provider text not null,
  query text not null,
  idempotency_key text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  result jsonb not null default '{}'::jsonb,
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  check (completed_at is null or started_at is not null),
  check (status not in ('succeeded', 'failed', 'cancelled') or completed_at is not null)
);

create table if not exists public.content_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  research_run_id uuid not null references public.content_research_runs(id) on delete cascade,
  source_id uuid references public.content_sources(id) on delete set null,
  source_url text not null,
  source_type text not null,
  publisher text,
  title text,
  excerpt text,
  locator text,
  content_hash text not null,
  authority_score numeric(5,2) check (authority_score between 0 and 100),
  verification_status text not null default 'unreviewed' check (verification_status in ('unreviewed', 'verified', 'disputed', 'rejected')),
  published_at timestamptz,
  retrieved_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, research_run_id, source_url, content_hash)
);

create table if not exists public.content_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  research_run_id uuid not null references public.content_research_runs(id) on delete cascade,
  claim_key text not null,
  claim_text text not null,
  claim_type text not null default 'factual' check (claim_type in ('factual', 'interpretation', 'allegation', 'opinion')),
  verification_status text not null default 'open' check (verification_status in ('open', 'confirmed', 'partially_confirmed', 'unconfirmed', 'conflicted', 'rejected')),
  confidence numeric(5,2) check (confidence between 0 and 100),
  is_critical boolean not null default false,
  checked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, research_run_id, claim_key),
  check (verification_status = 'open' or checked_at is not null)
);

create table if not exists public.content_claim_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  claim_id uuid not null references public.content_claims(id) on delete cascade,
  evidence_id uuid not null references public.content_evidence(id) on delete cascade,
  relationship text not null check (relationship in ('supports', 'contradicts', 'contextualizes')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, claim_id, evidence_id, relationship)
);

create table if not exists public.content_quality_gates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  research_run_id uuid references public.content_research_runs(id) on delete set null,
  gate_type text not null check (gate_type in ('research', 'fact_check', 'originality', 'seo', 'editorial', 'safety', 'publish')),
  status text not null default 'pending' check (status in ('pending', 'passed', 'failed', 'waived')),
  score numeric(5,2) check (score between 0 and 100),
  findings jsonb not null default '{}'::jsonb,
  checked_by text,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, content_item_id, gate_type),
  check (status = 'pending' or checked_at is not null)
);

create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  research_run_id uuid references public.content_research_runs(id) on delete set null,
  revision_number integer not null check (revision_number > 0),
  body jsonb not null default '{}'::jsonb,
  change_summary text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'superseded')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, content_item_id, revision_number)
);

create index if not exists content_research_runs_reconcile_idx on public.content_research_runs (organization_id, status, updated_at) where status in ('queued', 'running', 'failed');
create index if not exists content_research_runs_opportunity_idx on public.content_research_runs (organization_id, opportunity_id, created_at desc);
create index if not exists content_evidence_run_idx on public.content_evidence (organization_id, research_run_id, retrieved_at desc);
create index if not exists content_claims_run_idx on public.content_claims (organization_id, research_run_id, verification_status);
create index if not exists content_claim_evidence_claim_idx on public.content_claim_evidence (organization_id, claim_id);
create index if not exists content_quality_gates_pending_idx on public.content_quality_gates (organization_id, content_item_id, gate_type) where status = 'pending';
create index if not exists content_revisions_item_idx on public.content_revisions (organization_id, content_item_id, revision_number desc);

-- Every child reference must remain inside the same tenant, including service-role writes.
drop trigger if exists content_research_runs_opportunity_tenant on public.content_research_runs;
create trigger content_research_runs_opportunity_tenant before insert or update on public.content_research_runs for each row execute function public.content_os_enforce_tenant_fk('content_opportunities', 'opportunity_id');
drop trigger if exists content_research_runs_item_tenant on public.content_research_runs;
create trigger content_research_runs_item_tenant before insert or update on public.content_research_runs for each row execute function public.content_os_enforce_tenant_fk('content_items', 'content_item_id');
drop trigger if exists content_evidence_run_tenant on public.content_evidence;
create trigger content_evidence_run_tenant before insert or update on public.content_evidence for each row execute function public.content_os_enforce_tenant_fk('content_research_runs', 'research_run_id');
drop trigger if exists content_evidence_source_tenant on public.content_evidence;
create trigger content_evidence_source_tenant before insert or update on public.content_evidence for each row execute function public.content_os_enforce_tenant_fk('content_sources', 'source_id');
drop trigger if exists content_claims_run_tenant on public.content_claims;
create trigger content_claims_run_tenant before insert or update on public.content_claims for each row execute function public.content_os_enforce_tenant_fk('content_research_runs', 'research_run_id');
drop trigger if exists content_claim_evidence_claim_tenant on public.content_claim_evidence;
create trigger content_claim_evidence_claim_tenant before insert or update on public.content_claim_evidence for each row execute function public.content_os_enforce_tenant_fk('content_claims', 'claim_id');
drop trigger if exists content_claim_evidence_evidence_tenant on public.content_claim_evidence;
create trigger content_claim_evidence_evidence_tenant before insert or update on public.content_claim_evidence for each row execute function public.content_os_enforce_tenant_fk('content_evidence', 'evidence_id');
drop trigger if exists content_quality_gates_item_tenant on public.content_quality_gates;
create trigger content_quality_gates_item_tenant before insert or update on public.content_quality_gates for each row execute function public.content_os_enforce_tenant_fk('content_items', 'content_item_id');
drop trigger if exists content_quality_gates_run_tenant on public.content_quality_gates;
create trigger content_quality_gates_run_tenant before insert or update on public.content_quality_gates for each row execute function public.content_os_enforce_tenant_fk('content_research_runs', 'research_run_id');
drop trigger if exists content_revisions_item_tenant on public.content_revisions;
create trigger content_revisions_item_tenant before insert or update on public.content_revisions for each row execute function public.content_os_enforce_tenant_fk('content_items', 'content_item_id');
drop trigger if exists content_revisions_run_tenant on public.content_revisions;
create trigger content_revisions_run_tenant before insert or update on public.content_revisions for each row execute function public.content_os_enforce_tenant_fk('content_research_runs', 'research_run_id');

do $$
declare table_name text;
begin
  foreach table_name in array array['content_research_runs', 'content_evidence', 'content_claims', 'content_claim_evidence', 'content_quality_gates', 'content_revisions'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', table_name, table_name);
    execute format('create policy tenant_isolation_%s_all on public.%I for all to authenticated using ((organization_id in (select * from public.fn_user_org_ids())) or public.fn_is_platform_admin()) with check ((organization_id in (select * from public.fn_user_org_ids())) or public.fn_is_platform_admin())', table_name, table_name);
    execute format('drop trigger if exists %I on public.%I', 'trg_' || table_name || '_touch', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.fn_touch_updated_at()', 'trg_' || table_name || '_touch', table_name);
  end loop;
end $$;

