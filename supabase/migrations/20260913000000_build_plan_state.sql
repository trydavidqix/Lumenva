-- Additive durable state for Wave 9 repair and Wave 10 delivery gates.
create table if not exists public.build_plan_state (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null,
  step_id text not null,
  status text not null,
  attempts integer not null default 0 check (attempts >= 0),
  blocked_at timestamptz,
  tenant_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint build_plan_state_plan_step_tenant_key unique (tenant_id, plan_id, step_id)
);
create unique index if not exists build_plan_state_running_once
  on public.build_plan_state (tenant_id, plan_id, step_id)
  where status = 'RUNNING';
