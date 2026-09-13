-- 0142 Scenario Lab simulation: populations, runs, events and synthetic artifacts.

create table if not exists scenario_actor_templates (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenario_definitions(id) on delete cascade,
  key text not null,
  label text not null,
  weight numeric not null default 1 check (weight >= 0),
  traits jsonb not null default '{}'::jsonb,
  incentives jsonb not null default '{}'::jsonb,
  constraints jsonb not null default '{}'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, scenario_id, key)
);
create index if not exists scenario_actor_templates_org_scenario_idx
  on scenario_actor_templates (organization_id, scenario_id, key);

create table if not exists scenario_populations (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenario_definitions(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  seed bigint not null,
  size integer not null check (size > 0),
  generator_version text not null,
  synthetic boolean not null default true check (synthetic = true),
  config jsonb not null default '{}'::jsonb,
  actors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, scenario_id, version, seed)
);
create index if not exists scenario_populations_org_scenario_idx
  on scenario_populations (organization_id, scenario_id, version desc);

create table if not exists scenario_runs (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenario_definitions(id) on delete cascade,
  strategy_id uuid not null references scenario_strategies(id) on delete cascade,
  population_id uuid not null references scenario_populations(id) on delete cascade,
  status text not null default 'PENDING'
    check (status in ('PENDING','PREPARING','RUNNING','COMPLETED','CANCELLED','FAILED','TIMED_OUT')),
  seed bigint not null,
  engine text not null,
  engine_version text not null,
  compiler_version text not null,
  council_config_hash text,
  budget jsonb not null default '{}'::jsonb,
  external_run_id text,
  started_at timestamptz,
  ended_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scenario_runs_org_scenario_idx
  on scenario_runs (organization_id, scenario_id, status, created_at desc);
create index if not exists scenario_runs_org_strategy_idx
  on scenario_runs (organization_id, strategy_id, seed);

create table if not exists scenario_run_events (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenario_definitions(id) on delete cascade,
  run_id uuid not null references scenario_runs(id) on delete cascade,
  kind text not null,
  round integer,
  actor_id text,
  synthetic boolean not null default true check (synthetic = true),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists scenario_run_events_org_run_idx
  on scenario_run_events (organization_id, run_id, occurred_at);

create table if not exists scenario_agent_actions (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenario_definitions(id) on delete cascade,
  run_id uuid not null references scenario_runs(id) on delete cascade,
  actor_id text not null,
  action_kind text not null,
  synthetic boolean not null default true check (synthetic = true),
  seed bigint not null,
  engine_version text not null,
  model_version text,
  evidence_refs jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists scenario_agent_actions_org_run_idx
  on scenario_agent_actions (organization_id, run_id, occurred_at);
create index if not exists scenario_agent_actions_org_scenario_idx
  on scenario_agent_actions (organization_id, scenario_id, actor_id);

create table if not exists scenario_outcomes (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenario_definitions(id) on delete cascade,
  run_id uuid not null references scenario_runs(id) on delete cascade,
  strategy_id uuid not null references scenario_strategies(id) on delete cascade,
  outcome_key text not null,
  segment text,
  synthetic boolean not null default true check (synthetic = true),
  seed bigint not null,
  engine_version text not null,
  model_version text,
  evidence_refs jsonb not null default '[]'::jsonb,
  numeric_value numeric,
  text_value text,
  boolean_value boolean,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (num_nonnulls(numeric_value, text_value, boolean_value) <= 1)
);
create index if not exists scenario_outcomes_org_run_idx
  on scenario_outcomes (organization_id, run_id, outcome_key);
create index if not exists scenario_outcomes_org_strategy_idx
  on scenario_outcomes (organization_id, strategy_id, outcome_key);

alter table scenario_actor_templates enable row level security;
alter table scenario_populations enable row level security;
alter table scenario_runs enable row level security;
alter table scenario_run_events enable row level security;
alter table scenario_agent_actions enable row level security;
alter table scenario_outcomes enable row level security;

drop policy if exists tenant_isolation_scenario_actor_templates_all on scenario_actor_templates;
create policy tenant_isolation_scenario_actor_templates_all on scenario_actor_templates
  for all using (organization_id in (select fn_user_org_ids())) with check (organization_id in (select fn_user_org_ids()));
drop policy if exists tenant_isolation_scenario_populations_all on scenario_populations;
create policy tenant_isolation_scenario_populations_all on scenario_populations
  for all using (organization_id in (select fn_user_org_ids())) with check (organization_id in (select fn_user_org_ids()));
drop policy if exists tenant_isolation_scenario_runs_all on scenario_runs;
create policy tenant_isolation_scenario_runs_all on scenario_runs
  for all using (organization_id in (select fn_user_org_ids())) with check (organization_id in (select fn_user_org_ids()));
drop policy if exists tenant_isolation_scenario_run_events_all on scenario_run_events;
create policy tenant_isolation_scenario_run_events_all on scenario_run_events
  for all using (organization_id in (select fn_user_org_ids())) with check (organization_id in (select fn_user_org_ids()));
drop policy if exists tenant_isolation_scenario_agent_actions_all on scenario_agent_actions;
create policy tenant_isolation_scenario_agent_actions_all on scenario_agent_actions
  for all using (organization_id in (select fn_user_org_ids())) with check (organization_id in (select fn_user_org_ids()));
drop policy if exists tenant_isolation_scenario_outcomes_all on scenario_outcomes;
create policy tenant_isolation_scenario_outcomes_all on scenario_outcomes
  for all using (organization_id in (select fn_user_org_ids())) with check (organization_id in (select fn_user_org_ids()));
