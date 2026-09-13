-- Hermes Unified Learning OS — additive tenant-safe learning stores.
-- Prepared for branch-local verification only. Do not apply remotely as part
-- of the Hermes implementation session without separate production approval.

create table if not exists public.hermes_research_experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subject_kind text not null,
  subject_id text not null,
  context_fingerprint text not null,
  goal text not null,
  strategy text not null,
  metric_name text,
  baseline_value double precision,
  observed_value double precision,
  score double precision,
  status text not null check (status in ('keep', 'discard', 'crash', 'inconclusive')),
  evidence_refs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  source_version text,
  supersedes_id uuid references public.hermes_research_experiments(id),
  created_at timestamptz not null default now()
);

create index if not exists hermes_research_experiments_org_subject_idx
  on public.hermes_research_experiments (organization_id, subject_kind, subject_id, created_at desc);
create index if not exists hermes_research_experiments_org_fingerprint_idx
  on public.hermes_research_experiments (organization_id, context_fingerprint, created_at desc);

alter table public.hermes_research_experiments enable row level security;
drop policy if exists tenant_isolation_hermes_research_experiments_all on public.hermes_research_experiments;
create policy tenant_isolation_hermes_research_experiments_all
  on public.hermes_research_experiments for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));

create table if not exists public.hermes_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id text not null,
  mission_id text,
  candidate_id uuid,
  subject_kind text not null,
  subject_id text not null,
  technical_quality double precision check (
    technical_quality is null or (technical_quality >= 0 and technical_quality <= 1)
  ),
  cost_cents integer check (cost_cents is null or cost_cents >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  kpi_name text,
  kpi_baseline double precision,
  kpi_observed double precision,
  evidence_refs jsonb not null default '[]'::jsonb,
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists hermes_outcomes_org_run_idx
  on public.hermes_outcomes (organization_id, run_id, observed_at desc);
create index if not exists hermes_outcomes_org_subject_idx
  on public.hermes_outcomes (organization_id, subject_kind, subject_id, observed_at desc);

alter table public.hermes_outcomes enable row level security;
drop policy if exists tenant_isolation_hermes_outcomes_all on public.hermes_outcomes;
create policy tenant_isolation_hermes_outcomes_all
  on public.hermes_outcomes for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));

create table if not exists public.hermes_capability_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capability_kind text not null,
  canonical_identity text not null,
  immutable_revision text,
  content_fingerprint text not null,
  permission_fingerprint text not null,
  trust_status text not null check (trust_status in ('unknown', 'inspected', 'trusted', 'rejected', 'stale')),
  evidence_refs jsonb not null default '[]'::jsonb,
  inspected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (
    organization_id,
    capability_kind,
    canonical_identity,
    content_fingerprint,
    permission_fingerprint
  )
);

create index if not exists hermes_capability_identities_org_identity_idx
  on public.hermes_capability_identities (organization_id, capability_kind, canonical_identity, created_at desc);

alter table public.hermes_capability_identities enable row level security;
drop policy if exists tenant_isolation_hermes_capability_identities_all on public.hermes_capability_identities;
create policy tenant_isolation_hermes_capability_identities_all
  on public.hermes_capability_identities for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));

-- Preserve all historical proposal values while extending the governed Hermes
-- candidate vocabulary. No existing proposal row is rewritten.
alter table if exists public.flywheel_distiller_proposals
  drop constraint if exists flywheel_distiller_proposals_type_check;

alter table if exists public.flywheel_distiller_proposals
  add constraint flywheel_distiller_proposals_type_check
  check (
    type in (
      'playbook_bullet',
      'golden_case',
      'reentry_trigger',
      'org_memory_entry',
      'skill_change',
      'routing_change',
      'eval_case',
      'operational_threshold',
      'prompt_change',
      'workflow_change',
      'agent_definition_change',
      'model_policy_change',
      'resource_route_change',
      'memory_policy_change',
      'context_policy_change',
      'infra_change',
      'strategy_change'
    )
  );

comment on constraint flywheel_distiller_proposals_type_check on public.flywheel_distiller_proposals is
  'Legacy Flywheel types plus the governed Hermes Learning OS proposal allowlist.';
