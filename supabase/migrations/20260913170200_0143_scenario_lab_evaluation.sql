-- 0143 Scenario Lab evaluation: metrics, comparisons and decision reports.

create table if not exists scenario_metrics (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenario_definitions(id) on delete cascade,
  run_id uuid references scenario_runs(id) on delete cascade,
  strategy_id uuid references scenario_strategies(id) on delete cascade,
  metric_key text not null,
  segment text,
  synthetic boolean not null default true check (synthetic = true),
  mean_value numeric,
  median_value numeric,
  p10_value numeric,
  p90_value numeric,
  variance_value numeric,
  direction_consistency numeric check (direction_consistency is null or (direction_consistency >= 0 and direction_consistency <= 1)),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists scenario_metrics_org_scenario_idx
  on scenario_metrics (organization_id, scenario_id, metric_key);
create index if not exists scenario_metrics_org_strategy_idx
  on scenario_metrics (organization_id, strategy_id, metric_key);

create table if not exists scenario_comparisons (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenario_definitions(id) on delete cascade,
  baseline_strategy_id uuid references scenario_strategies(id) on delete set null,
  strategy_ranking jsonb not null default '[]'::jsonb,
  sensitivity jsonb not null default '[]'::jsonb,
  evidence_coverage numeric not null default 0 check (evidence_coverage >= 0 and evidence_coverage <= 1),
  run_count integer not null default 0 check (run_count >= 0),
  failed_run_count integer not null default 0 check (failed_run_count >= 0),
  evaluator_version text not null,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists scenario_comparisons_org_scenario_idx
  on scenario_comparisons (organization_id, scenario_id, generated_at desc);

create table if not exists scenario_reports (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenario_definitions(id) on delete cascade,
  comparison_id uuid references scenario_comparisons(id) on delete set null,
  synthetic boolean not null default true check (synthetic = true),
  report_kind text not null default 'decision_brief' check (report_kind in ('decision_brief','council_review','backtest_brief')),
  question text not null,
  recommendation text,
  strongest_effects jsonb not null default '[]'::jsonb,
  uncertainty jsonb not null default '[]'::jsonb,
  segment_impacts jsonb not null default '[]'::jsonb,
  critical_assumptions jsonb not null default '[]'::jsonb,
  sensitivity_findings jsonb not null default '[]'::jsonb,
  council_disagreements jsonb not null default '[]'::jsonb,
  evidence_coverage numeric not null default 0 check (evidence_coverage >= 0 and evidence_coverage <= 1),
  confidence_components jsonb not null default '{}'::jsonb,
  confidence_composite numeric check (confidence_composite is null or (confidence_composite >= 0 and confidence_composite <= 1)),
  confidence_formula_version text not null,
  next_validation_steps jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists scenario_reports_org_scenario_idx
  on scenario_reports (organization_id, scenario_id, created_at desc);

alter table scenario_metrics enable row level security;
alter table scenario_comparisons enable row level security;
alter table scenario_reports enable row level security;

drop policy if exists tenant_isolation_scenario_metrics_all on scenario_metrics;
create policy tenant_isolation_scenario_metrics_all on scenario_metrics
  for all using (organization_id in (select fn_user_org_ids())) with check (organization_id in (select fn_user_org_ids()));
drop policy if exists tenant_isolation_scenario_comparisons_all on scenario_comparisons;
create policy tenant_isolation_scenario_comparisons_all on scenario_comparisons
  for all using (organization_id in (select fn_user_org_ids())) with check (organization_id in (select fn_user_org_ids()));
drop policy if exists tenant_isolation_scenario_reports_all on scenario_reports;
create policy tenant_isolation_scenario_reports_all on scenario_reports
  for all using (organization_id in (select fn_user_org_ids())) with check (organization_id in (select fn_user_org_ids()));
