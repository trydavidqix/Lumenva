-- Creator Commerce Revenue OS: tenant-scoped catalog, affiliate, revenue,
-- content, experimentation, learning and connector durability.
-- Additive only. No production data backfill and no external side effects.

create table if not exists public.commerce_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  canonical_sku text not null check (btrim(canonical_sku) <> ''),
  title text not null check (btrim(title) <> ''),
  description text,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, canonical_sku)
);
create index if not exists commerce_products_org_status_idx on public.commerce_products (organization_id, status, updated_at desc);

create table if not exists public.commerce_product_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  sku text not null check (btrim(sku) <> ''),
  title text not null,
  inventory_quantity integer,
  status text not null default 'active' check (status in ('active','archived')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku)
);
create index if not exists commerce_product_variants_org_product_idx on public.commerce_product_variants (organization_id, product_id);

create table if not exists public.commerce_external_mappings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  store_id text not null check (btrim(store_id) <> ''),
  external_product_id text not null check (btrim(external_product_id) <> ''),
  external_variant_id text,
  source text not null,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (organization_id, store_id, external_product_id)
);
create index if not exists commerce_external_mappings_org_product_idx on public.commerce_external_mappings (organization_id, product_id);

create table if not exists public.commerce_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.commerce_products(id) on delete cascade,
  name text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  inventory_quantity integer,
  margin_floor_bps integer check (margin_floor_bps between 0 and 10000),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default false,
  approval_state text not null default 'not_required' check (approval_state in ('not_required','pending','approved','rejected')),
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists commerce_offers_org_status_idx on public.commerce_offers (organization_id, status, is_active);

create table if not exists public.commerce_offer_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  offer_id uuid not null references public.commerce_offers(id) on delete cascade,
  variant_id uuid not null references public.commerce_product_variants(id) on delete cascade,
  unit_amount_minor bigint check (unit_amount_minor is null or unit_amount_minor >= 0),
  inventory_quantity integer,
  created_at timestamptz not null default now(),
  unique (organization_id, offer_id, variant_id)
);

create table if not exists public.commerce_affiliates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (btrim(code) <> ''),
  display_name text not null,
  status text not null default 'active' check (status in ('active','paused','disabled')),
  commission_bps integer not null default 0 check (commission_bps between 0 and 10000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.commerce_affiliate_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  affiliate_id uuid not null references public.commerce_affiliates(id) on delete cascade,
  offer_id uuid references public.commerce_offers(id) on delete cascade,
  code text not null check (btrim(code) <> ''),
  destination_url text not null,
  status text not null default 'active' check (status in ('active','paused','disabled')),
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.commerce_affiliate_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  affiliate_id uuid references public.commerce_affiliates(id) on delete set null,
  link_id uuid references public.commerce_affiliate_links(id) on delete set null,
  source text not null,
  external_event_id text not null,
  event_type text not null check (event_type in ('click','lead','checkout','purchase','refund')),
  attribution_key text,
  amount_minor bigint check (amount_minor is null or amount_minor >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  created_at timestamptz not null default now(),
  unique (organization_id, source, external_event_id)
);
create index if not exists commerce_affiliate_events_org_occurred_idx on public.commerce_affiliate_events (organization_id, occurred_at desc);

create table if not exists public.commerce_commission_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  affiliate_id uuid not null references public.commerce_affiliates(id) on delete restrict,
  affiliate_event_id uuid references public.commerce_affiliate_events(id) on delete set null,
  source text not null,
  external_event_id text not null,
  entry_type text not null check (entry_type in ('accrual','adjustment','reversal','payout')),
  amount_minor bigint not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, source, external_event_id)
);
create index if not exists commerce_commission_ledger_org_affiliate_idx on public.commerce_commission_ledger (organization_id, affiliate_id, occurred_at desc);

create table if not exists public.commerce_revenue_attribution (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null,
  external_event_id text not null,
  order_reference text,
  content_item_id uuid,
  affiliate_id uuid references public.commerce_affiliates(id) on delete set null,
  channel text,
  campaign text,
  model text not null default 'last_touch' check (model in ('first_touch','last_touch','linear','direct')),
  attributed_amount_minor bigint not null check (attributed_amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (organization_id, source, external_event_id)
);
create index if not exists commerce_revenue_attribution_org_occurred_idx on public.commerce_revenue_attribution (organization_id, occurred_at desc);

create table if not exists public.commerce_revenue_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null,
  external_event_id text not null,
  entry_type text not null check (entry_type in ('gross_sale','discount','tax','fee','refund','chargeback','adjustment')),
  order_reference text,
  amount_minor bigint not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (organization_id, source, external_event_id)
);
create index if not exists commerce_revenue_ledger_org_occurred_idx on public.commerce_revenue_ledger (organization_id, occurred_at desc);

create table if not exists public.commerce_reconciliation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  started_at timestamptz,
  finished_at timestamptz,
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default now(),
  check (period_end > period_start)
);

create table if not exists public.commerce_reconciliation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reconciliation_run_id uuid not null references public.commerce_reconciliation_runs(id) on delete cascade,
  source text not null,
  external_reference text not null,
  status text not null check (status in ('matched','missing_internal','missing_external','amount_mismatch','ignored')),
  internal_amount_minor bigint,
  external_amount_minor bigint,
  currency text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  unique (organization_id, reconciliation_run_id, source, external_reference)
);

create table if not exists public.commerce_content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_type text not null check (content_type in ('post','short_video','long_video','story','email','landing_page','ad')),
  title text not null,
  body text,
  status text not null default 'draft' check (status in ('draft','review','approved','scheduled','published','archived')),
  product_id uuid references public.commerce_products(id) on delete set null,
  offer_id uuid references public.commerce_offers(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commerce_content_items_org_status_idx on public.commerce_content_items (organization_id, status, updated_at desc);

create table if not exists public.commerce_content_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.commerce_content_items(id) on delete cascade,
  variant_key text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  unique (organization_id, content_item_id, variant_key)
);

create table if not exists public.commerce_publications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.commerce_content_items(id) on delete cascade,
  content_variant_id uuid references public.commerce_content_variants(id) on delete set null,
  channel text not null,
  account_ref text not null,
  external_publication_id text,
  idempotency_key text not null,
  scheduled_at timestamptz,
  published_at timestamptz,
  status text not null default 'draft' check (status in ('draft','approval_pending','scheduled','publishing','published','failed','cancelled')),
  error_code text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index if not exists commerce_publications_org_status_idx on public.commerce_publications (organization_id, status, scheduled_at);

create table if not exists public.commerce_content_performance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  publication_id uuid not null references public.commerce_publications(id) on delete cascade,
  source text not null,
  external_event_id text not null,
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  engagements bigint not null default 0 check (engagements >= 0),
  conversions bigint not null default 0 check (conversions >= 0),
  revenue_amount_minor bigint not null default 0,
  currency text,
  observed_at timestamptz not null,
  unique (organization_id, source, external_event_id)
);

create table if not exists public.commerce_ads_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null,
  account_ref text not null,
  campaign_ref text,
  spend_amount_minor bigint not null default 0 check (spend_amount_minor >= 0),
  impressions bigint not null default 0 check (impressions >= 0),
  clicks bigint not null default 0 check (clicks >= 0),
  conversions bigint not null default 0 check (conversions >= 0),
  revenue_amount_minor bigint not null default 0,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  observed_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (organization_id, source, account_ref, campaign_ref, observed_at)
);

create table if not exists public.commerce_experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  hypothesis text not null,
  metric_name text not null,
  status text not null default 'draft' check (status in ('draft','running','paused','completed','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commerce_experiments_org_status_idx on public.commerce_experiments (organization_id, status, updated_at desc);

create table if not exists public.commerce_experiment_arms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.commerce_experiments(id) on delete cascade,
  key text not null,
  weight_bps integer not null check (weight_bps between 0 and 10000),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  unique (organization_id, experiment_id, key)
);

create table if not exists public.commerce_experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.commerce_experiments(id) on delete cascade,
  arm_id uuid not null references public.commerce_experiment_arms(id) on delete cascade,
  subject_key text not null,
  assigned_at timestamptz not null default now(),
  unique (organization_id, experiment_id, subject_key)
);

create table if not exists public.commerce_experiment_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null references public.commerce_experiments(id) on delete cascade,
  arm_id uuid not null references public.commerce_experiment_arms(id) on delete cascade,
  assignment_id uuid references public.commerce_experiment_assignments(id) on delete set null,
  source text not null,
  external_event_id text not null,
  metric_name text not null,
  metric_value numeric(20,6) not null,
  occurred_at timestamptz not null,
  unique (organization_id, source, external_event_id)
);

create table if not exists public.commerce_learning_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null,
  external_event_id text not null,
  event_type text not null,
  subject_kind text not null,
  subject_id text not null,
  score numeric(12,6),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, source, external_event_id)
);
create index if not exists commerce_learning_events_org_occurred_idx on public.commerce_learning_events (organization_id, occurred_at desc);

create table if not exists public.commerce_policy_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  policy_kind text not null,
  current_version_id uuid,
  proposal jsonb not null check (jsonb_typeof(proposal) = 'object'),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  status text not null default 'candidate' check (status in ('candidate','pending_approval','approved','rejected','active','superseded')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);
create index if not exists commerce_policy_candidates_org_status_idx on public.commerce_policy_candidates (organization_id, status, created_at desc);

create table if not exists public.commerce_policy_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  policy_kind text not null,
  version integer not null check (version > 0),
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  candidate_id uuid references public.commerce_policy_candidates(id) on delete set null,
  status text not null default 'active' check (status in ('active','superseded','rolled_back')),
  activated_at timestamptz not null default now(),
  supersedes_id uuid references public.commerce_policy_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, policy_kind, version)
);

alter table public.commerce_policy_candidates
  add constraint commerce_policy_candidates_current_version_fk
  foreign key (current_version_id) references public.commerce_policy_versions(id) on delete set null;

create table if not exists public.commerce_connector_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connector text not null,
  external_account_id text not null,
  status text not null default 'active' check (status in ('active','degraded','disabled','reauth_required')),
  capabilities jsonb not null default '[]'::jsonb check (jsonb_typeof(capabilities) = 'array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, connector, external_account_id)
);

create table if not exists public.commerce_webhook_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null,
  external_event_id text not null,
  event_type text not null,
  payload_hash text not null,
  status text not null default 'received' check (status in ('received','processing','processed','ignored','failed')),
  attempts integer not null default 0 check (attempts >= 0),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error_code text,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  unique (organization_id, source, external_event_id)
);
create index if not exists commerce_webhook_events_org_status_idx on public.commerce_webhook_events (organization_id, status, received_at);

create table if not exists public.commerce_sync_cursors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connector_account_id uuid not null references public.commerce_connector_accounts(id) on delete cascade,
  resource text not null,
  cursor text,
  source_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  unique (organization_id, connector_account_id, resource)
);

create table if not exists public.commerce_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_type text not null,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  run_after timestamptz not null default now(),
  priority integer not null default 100,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts > 0),
  locked_at timestamptz,
  locked_by text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index if not exists commerce_jobs_org_status_run_after_idx on public.commerce_jobs (organization_id, status, run_after, priority);

create table if not exists public.commerce_job_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.commerce_jobs(id) on delete cascade,
  attempt integer not null check (attempt > 0),
  status text not null check (status in ('running','succeeded','failed','cancelled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_code text,
  result jsonb,
  unique (organization_id, job_id, attempt)
);

-- Every table is tenant-owned. Keep authenticated access inside fn_user_org_ids();
-- trusted service-role callers still MUST add an explicit organization_id filter.
alter table public.commerce_products enable row level security;
create policy commerce_products_tenant_all on public.commerce_products for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_product_variants enable row level security;
create policy commerce_product_variants_tenant_all on public.commerce_product_variants for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_external_mappings enable row level security;
create policy commerce_external_mappings_tenant_all on public.commerce_external_mappings for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_offers enable row level security;
create policy commerce_offers_tenant_all on public.commerce_offers for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_offer_variants enable row level security;
create policy commerce_offer_variants_tenant_all on public.commerce_offer_variants for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_affiliates enable row level security;
create policy commerce_affiliates_tenant_all on public.commerce_affiliates for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_affiliate_links enable row level security;
create policy commerce_affiliate_links_tenant_all on public.commerce_affiliate_links for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_affiliate_events enable row level security;
create policy commerce_affiliate_events_tenant_all on public.commerce_affiliate_events for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_commission_ledger enable row level security;
create policy commerce_commission_ledger_tenant_all on public.commerce_commission_ledger for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_revenue_attribution enable row level security;
create policy commerce_revenue_attribution_tenant_all on public.commerce_revenue_attribution for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_revenue_ledger enable row level security;
create policy commerce_revenue_ledger_tenant_all on public.commerce_revenue_ledger for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_reconciliation_runs enable row level security;
create policy commerce_reconciliation_runs_tenant_all on public.commerce_reconciliation_runs for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_reconciliation_items enable row level security;
create policy commerce_reconciliation_items_tenant_all on public.commerce_reconciliation_items for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_content_items enable row level security;
create policy commerce_content_items_tenant_all on public.commerce_content_items for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_content_variants enable row level security;
create policy commerce_content_variants_tenant_all on public.commerce_content_variants for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_publications enable row level security;
create policy commerce_publications_tenant_all on public.commerce_publications for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_content_performance enable row level security;
create policy commerce_content_performance_tenant_all on public.commerce_content_performance for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_ads_snapshots enable row level security;
create policy commerce_ads_snapshots_tenant_all on public.commerce_ads_snapshots for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_experiments enable row level security;
create policy commerce_experiments_tenant_all on public.commerce_experiments for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_experiment_arms enable row level security;
create policy commerce_experiment_arms_tenant_all on public.commerce_experiment_arms for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_experiment_assignments enable row level security;
create policy commerce_experiment_assignments_tenant_all on public.commerce_experiment_assignments for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_experiment_outcomes enable row level security;
create policy commerce_experiment_outcomes_tenant_all on public.commerce_experiment_outcomes for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_learning_events enable row level security;
create policy commerce_learning_events_tenant_all on public.commerce_learning_events for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_policy_candidates enable row level security;
create policy commerce_policy_candidates_tenant_all on public.commerce_policy_candidates for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_policy_versions enable row level security;
create policy commerce_policy_versions_tenant_all on public.commerce_policy_versions for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_connector_accounts enable row level security;
create policy commerce_connector_accounts_tenant_all on public.commerce_connector_accounts for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_webhook_events enable row level security;
create policy commerce_webhook_events_tenant_all on public.commerce_webhook_events for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_sync_cursors enable row level security;
create policy commerce_sync_cursors_tenant_all on public.commerce_sync_cursors for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_jobs enable row level security;
create policy commerce_jobs_tenant_all on public.commerce_jobs for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_job_runs enable row level security;
create policy commerce_job_runs_tenant_all on public.commerce_job_runs for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

notify pgrst, 'reload schema';
