-- TOKENS workforce persistence schema. Apply through the project's normal migration system after review.
create table if not exists maestri_master_plans (
  plan_id text primary key,
  objective text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists maestri_executions (
  execution_id text primary key,
  plan_id text,
  task_id text not null,
  provider text,
  model text,
  status text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists maestri_executions_task_idx on maestri_executions(task_id, created_at desc);
create table if not exists maestri_result_digests (
  id bigserial primary key,
  task_id text not null,
  execution_id text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists maestri_routing_traces (
  trace_id text primary key,
  task_id text not null,
  provider text not null,
  model text,
  phase text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists maestri_routing_observations (
  id bigserial primary key,
  model_id text not null,
  task_type text not null,
  risk text not null,
  complexity text not null,
  success boolean not null,
  reviewer_accepted boolean not null,
  deterministic_passed boolean not null,
  retries integer not null default 0,
  latency_ms integer,
  cost_usd numeric,
  created_at timestamptz not null default now()
);
create index if not exists maestri_routing_observations_model_idx on maestri_routing_observations(model_id, task_type, created_at desc);

create table if not exists maestri_run_states (
  run_id text primary key,
  plan_id text not null,
  state text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists maestri_approvals (
  approval_id text primary key,
  task_id text not null,
  risk text not null,
  status text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists maestri_approvals_task_idx on maestri_approvals(task_id, created_at desc);
create table if not exists maestri_telemetry_events (
  event_id text primary key,
  event_type text not null,
  task_id text,
  execution_id text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists maestri_telemetry_task_idx on maestri_telemetry_events(task_id, created_at desc);
