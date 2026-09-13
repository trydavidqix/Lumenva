-- Wave 10.1 Mobile Compliance Guardian: immutable release evidence with tenant RLS.

create table if not exists public.mobile_policy_snapshots (
  tenant_id text not null,
  snapshot_id text not null,
  provider text not null check (provider in ('APPLE','GOOGLE')),
  version text not null,
  rules_hash text not null,
  source_refs jsonb not null default '[]'::jsonb,
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, snapshot_id)
);

create table if not exists public.mobile_compliance_reports (
  tenant_id text not null,
  report_id text not null,
  project_id text not null,
  build_ref text not null,
  artifact_ref text not null,
  artifact_hash text not null,
  platform text not null check (platform in ('IOS','ANDROID')),
  store text not null check (store in ('APP_STORE','PLAY_STORE')),
  policy_version text not null,
  policy_snapshot_hash text not null,
  verdict text not null check (verdict in ('PASS','PASS_WITH_WARNINGS','NEEDS_REVIEW','BLOCK')),
  findings jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  runtime_review_id text,
  critical_count integer not null default 0 check (critical_count >= 0),
  high_count integer not null default 0 check (high_count >= 0),
  medium_count integer not null default 0 check (medium_count >= 0),
  low_count integer not null default 0 check (low_count >= 0),
  created_at timestamptz not null,
  primary key (tenant_id, report_id),
  unique (tenant_id, project_id, build_ref, artifact_hash, policy_snapshot_hash)
);

create table if not exists public.mobile_runtime_reviews (
  tenant_id text not null,
  runtime_review_id text not null,
  report_id text not null,
  platform text not null check (platform in ('IOS','ANDROID')),
  status text not null check (status in ('PASS','FAIL','NOT_RUN','INFRA_FAILURE','NEEDS_REVIEW')),
  evidence_refs jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  primary key (tenant_id, runtime_review_id)
);

create table if not exists public.mobile_compliance_evidence (
  tenant_id text not null,
  evidence_id text not null,
  report_id text not null,
  rule_id text not null,
  resource text not null,
  line integer check (line is null or line > 0),
  excerpt_hash text not null,
  detector text not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, evidence_id)
);

create index if not exists mobile_compliance_reports_project_idx on public.mobile_compliance_reports (tenant_id, project_id, created_at desc);
create index if not exists mobile_compliance_evidence_report_idx on public.mobile_compliance_evidence (tenant_id, report_id);
create index if not exists mobile_runtime_reviews_report_idx on public.mobile_runtime_reviews (tenant_id, report_id);

alter table public.mobile_policy_snapshots enable row level security;
alter table public.mobile_compliance_reports enable row level security;
alter table public.mobile_runtime_reviews enable row level security;
alter table public.mobile_compliance_evidence enable row level security;

drop policy if exists mobile_policy_snapshots_tenant on public.mobile_policy_snapshots;
create policy mobile_policy_snapshots_tenant on public.mobile_policy_snapshots for all to authenticated using (tenant_id = current_setting('app.tenant_id', true)) with check (tenant_id = current_setting('app.tenant_id', true));
drop policy if exists mobile_compliance_reports_tenant on public.mobile_compliance_reports;
create policy mobile_compliance_reports_tenant on public.mobile_compliance_reports for all to authenticated using (tenant_id = current_setting('app.tenant_id', true)) with check (tenant_id = current_setting('app.tenant_id', true));
drop policy if exists mobile_runtime_reviews_tenant on public.mobile_runtime_reviews;
create policy mobile_runtime_reviews_tenant on public.mobile_runtime_reviews for all to authenticated using (tenant_id = current_setting('app.tenant_id', true)) with check (tenant_id = current_setting('app.tenant_id', true));
drop policy if exists mobile_compliance_evidence_tenant on public.mobile_compliance_evidence;
create policy mobile_compliance_evidence_tenant on public.mobile_compliance_evidence for all to authenticated using (tenant_id = current_setting('app.tenant_id', true)) with check (tenant_id = current_setting('app.tenant_id', true));

create table if not exists public.delivery_receipts (
  tenant_id text not null,
  delivery_receipt_id text not null,
  delivery_plan_id text not null,
  organization_id text not null,
  artifact_refs jsonb not null,
  environment text not null,
  actor_id text not null,
  channel text not null,
  approval_id text,
  result text not null,
  support_ticket_ref text,
  evidence_refs jsonb not null,
  created_at timestamptz not null,
  content_hash text not null,
  compliance_report_ref text,
  runtime_review_ref text,
  policy_snapshot_ref text,
  primary key (tenant_id, delivery_receipt_id)
);
alter table public.delivery_receipts add column if not exists compliance_report_ref text;
alter table public.delivery_receipts add column if not exists runtime_review_ref text;
alter table public.delivery_receipts add column if not exists policy_snapshot_ref text;
create unique index if not exists delivery_receipts_global_id on public.delivery_receipts (delivery_receipt_id);
alter table public.delivery_receipts enable row level security;
drop policy if exists delivery_receipts_tenant_isolation on public.delivery_receipts;
create policy delivery_receipts_tenant_isolation on public.delivery_receipts for all to authenticated using (tenant_id = current_setting('app.tenant_id', true)) with check (tenant_id = current_setting('app.tenant_id', true));

notify pgrst, 'reload schema';
