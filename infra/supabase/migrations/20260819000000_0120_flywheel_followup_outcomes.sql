-- Phase 10 Flywheel: outcome persistence
-- Tracks follow-up enrollment outcomes per flywheel run + organization
-- Used to measure proposal effectiveness (applied proposals → conversions/handoffs/etc)

create table if not exists flywheel_followup_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  run_id uuid not null,
  outcome text not null check (outcome in ('converted', 'replied', 'exhausted', 'opted_out', 'handoff', 'in_flight')),
  count int not null default 1,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_flywheel_followup_outcomes_org_run
  on flywheel_followup_outcomes(organization_id, run_id);

create index if not exists idx_flywheel_followup_outcomes_org_outcome
  on flywheel_followup_outcomes(organization_id, outcome);

alter table flywheel_followup_outcomes enable row level security;

create policy "org isolation" on flywheel_followup_outcomes
  for all using (
    organization_id in (
      select distinct organization_id
      from user_organizations uo
      where uo.user_id = auth.uid()
    )
  );

grant select, insert on flywheel_followup_outcomes to authenticated;
grant select, insert on flywheel_followup_outcomes to service_role;

comment on table flywheel_followup_outcomes is
  'Phase 10 Flywheel: tracks follow-up outcomes per judge run. '
  'Enables measurement of proposal effectiveness (did approved proposals improve conversions?). '
  'Append-only: one row per outcome type per run per org.';

comment on column flywheel_followup_outcomes.outcome is
  'Outcome type from followup_enrollments.outcome. '
  'Values: converted (customer paid), replied (engaged), exhausted (automation spent quota), '
  'opted_out (customer STOP), handoff (routed to human), in_flight (still waiting).';

comment on column flywheel_followup_outcomes.count is
  'Aggregate count of enrollments with this outcome in this run. '
  'Allows efficient aggregation without row explosion.';

comment on column flywheel_followup_outcomes.recorded_at is
  'Timestamp when the aggregation was computed (from aggregateFollowupOutcomes worker). '
  'May lag actual completion by several minutes.';
