-- 0144 Scenario Lab calibration: historical backtests and inspectable calibration summaries.

create table if not exists scenario_backtests (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_id uuid not null references scenario_definitions(id) on delete cascade,
  report_id uuid references scenario_reports(id) on delete set null,
  cutoff_at timestamptz not null,
  observed_outcome_at timestamptz,
  observed_outcome jsonb not null default '{}'::jsonb,
  simulated_summary jsonb not null default '{}'::jsonb,
  synthetic boolean not null default true check (synthetic = true),
  direction_accuracy numeric check (direction_accuracy is null or (direction_accuracy >= 0 and direction_accuracy <= 1)),
  magnitude_error numeric,
  ranking_accuracy numeric check (ranking_accuracy is null or (ranking_accuracy >= 0 and ranking_accuracy <= 1)),
  interval_coverage numeric check (interval_coverage is null or (interval_coverage >= 0 and interval_coverage <= 1)),
  seed_variance numeric,
  evidence_cutoff_verified boolean not null default false,
  evaluator_version text not null,
  created_at timestamptz not null default now()
);
create index if not exists scenario_backtests_org_scenario_idx
  on scenario_backtests (organization_id, scenario_id, cutoff_at desc);

create table if not exists scenario_calibration (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scenario_type text not null,
  sample_count integer not null default 0 check (sample_count >= 0),
  direction_accuracy numeric check (direction_accuracy is null or (direction_accuracy >= 0 and direction_accuracy <= 1)),
  mean_magnitude_error numeric,
  ranking_accuracy numeric check (ranking_accuracy is null or (ranking_accuracy >= 0 and ranking_accuracy <= 1)),
  interval_coverage numeric check (interval_coverage is null or (interval_coverage >= 0 and interval_coverage <= 1)),
  run_stability numeric check (run_stability is null or (run_stability >= 0 and run_stability <= 1)),
  synthetic boolean not null default true check (synthetic = true),
  formula_version text not null,
  window_start timestamptz,
  window_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists scenario_calibration_org_type_idx
  on scenario_calibration (organization_id, scenario_type, computed_at desc);

alter table scenario_backtests enable row level security;
alter table scenario_calibration enable row level security;

drop policy if exists tenant_isolation_scenario_backtests_all on scenario_backtests;
create policy tenant_isolation_scenario_backtests_all on scenario_backtests
  for all using (organization_id in (select fn_user_org_ids())) with check (organization_id in (select fn_user_org_ids()));
drop policy if exists tenant_isolation_scenario_calibration_all on scenario_calibration;
create policy tenant_isolation_scenario_calibration_all on scenario_calibration
  for all using (organization_id in (select fn_user_org_ids())) with check (organization_id in (select fn_user_org_ids()));
