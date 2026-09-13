-- 0141 Scenario Lab core: governed decision experiments, evidence, assumptions and strategies.

create table if not exists scenario_definitions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  title text,
  question text not null check (length(trim(question)) > 0),
  status text not null default 'DRAFT'
    check (status in ('DRAFT','EVIDENCE_READY','COMPILED','READY','RUNNING','ANALYZING','COMPLETED','CANCELLED','FAILED','EXPIRED')),
  decision_variables jsonb not null default '{}'::jsonb,
  constraints jsonb not null default '{}'::jsonb,
  budget jsonb not null default '{}'::jsonb,
  compiler_version text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists scenario_definitions_org_status_idx
  on scenario_definitions (organization_id, status, updated_at desc);
create index if not exists scenario_definitions_org_created_idx
  on scenario_definitions (organization_id, created_at desc);

create table if not exists scenario_evidence (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenario_definitions(id) on delete cascade,
  source_kind text not null
    check (source_kind in ('observed_fact','derived_fact','user_assumption','council_hypothesis','simulation_parameter')),
  authority text not null
    check (authority in ('authoritative_crm','published_knowledge','derived_memory','external_research','model_prior')),
  source_type text not null,
  source_ref text not null,
  observed_at timestamptz,
  retrieved_at timestamptz not null default now(),
  content jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists scenario_evidence_org_scenario_idx
  on scenario_evidence (organization_id, scenario_id, authority);
create index if not exists scenario_evidence_org_source_idx
  on scenario_evidence (organization_id, source_type, source_ref);

create table if not exists scenario_assumptions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenario_definitions(id) on delete cascade,
  statement text not null check (length(trim(statement)) > 0),
  source_kind text not null
    check (source_kind in ('user_assumption','council_hypothesis','simulation_parameter')),
  sensitivity_key text,
  value jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scenario_assumptions_org_scenario_idx
  on scenario_assumptions (organization_id, scenario_id, source_kind);

create table if not exists scenario_strategies (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenario_definitions(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  parameters jsonb not null default '{}'::jsonb,
  is_baseline boolean not null default false,
  source text not null default 'user' check (source in ('user','council','system')),
  evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scenario_strategies_org_scenario_idx
  on scenario_strategies (organization_id, scenario_id, created_at);
create unique index if not exists scenario_strategies_one_baseline_idx
  on scenario_strategies (organization_id, scenario_id) where is_baseline = true;

alter table scenario_definitions enable row level security;
alter table scenario_evidence enable row level security;
alter table scenario_assumptions enable row level security;
alter table scenario_strategies enable row level security;

drop policy if exists tenant_isolation_scenario_definitions_all on scenario_definitions;
create policy tenant_isolation_scenario_definitions_all on scenario_definitions
  for all using (organization_id in (select fn_user_org_ids()))
  with check (organization_id in (select fn_user_org_ids()));

drop policy if exists tenant_isolation_scenario_evidence_all on scenario_evidence;
create policy tenant_isolation_scenario_evidence_all on scenario_evidence
  for all using (organization_id in (select fn_user_org_ids()))
  with check (organization_id in (select fn_user_org_ids()));

drop policy if exists tenant_isolation_scenario_assumptions_all on scenario_assumptions;
create policy tenant_isolation_scenario_assumptions_all on scenario_assumptions
  for all using (organization_id in (select fn_user_org_ids()))
  with check (organization_id in (select fn_user_org_ids()));

drop policy if exists tenant_isolation_scenario_strategies_all on scenario_strategies;
create policy tenant_isolation_scenario_strategies_all on scenario_strategies
  for all using (organization_id in (select fn_user_org_ids()))
  with check (organization_id in (select fn_user_org_ids()));
