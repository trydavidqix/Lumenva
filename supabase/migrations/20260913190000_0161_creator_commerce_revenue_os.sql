-- Creator Commerce + Revenue OS canonical durable schema.
-- Additive, tenant-scoped and provider-neutral. Money is always integer minor units.

create table if not exists public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  handle text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active','paused','archived')),
  market text,
  language text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, handle)
);

create table if not exists public.commerce_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  canonical_sku text not null check (btrim(canonical_sku) <> ''),
  title text not null check (btrim(title) <> ''),
  description text,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, canonical_sku)
);
create index if not exists commerce_products_org_status_idx on public.commerce_products (organization_id, status, updated_at desc);

create table if not exists public.commerce_offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  provider text,
  external_id text,
  name text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  commission_bps integer check (commission_bps is null or commission_bps between 0 and 10000),
  inventory_quantity integer,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, product_id) references public.commerce_products(organization_id, id) on delete cascade,
  unique (organization_id, provider, external_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists commerce_offers_org_status_idx on public.commerce_offers (organization_id, status, updated_at desc);

create table if not exists public.commerce_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  creator_profile_id uuid,
  offer_id uuid,
  name text not null,
  market text,
  language text,
  status text not null default 'draft' check (status in ('draft','active','paused','completed','archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, creator_profile_id) references public.creator_profiles(organization_id, id) on delete set null,
  foreign key (organization_id, offer_id) references public.commerce_offers(organization_id, id) on delete set null
);
create index if not exists commerce_campaigns_org_status_idx on public.commerce_campaigns (organization_id, status, updated_at desc);

create table if not exists public.creative_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null,
  content_ref text,
  hook text,
  cta text,
  format text,
  language text,
  market text,
  status text not null default 'draft' check (status in ('draft','review','approved','published','archived')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, campaign_id) references public.commerce_campaigns(organization_id, id) on delete cascade
);

create table if not exists public.provider_country_capabilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  country text not null check (country ~ '^[A-Z]{2}$'),
  capability text not null,
  status text not null check (status in ('ALLOW','REVIEW_REQUIRED','DENY','UNKNOWN')),
  requirements jsonb not null default '[]'::jsonb check (jsonb_typeof(requirements) = 'array'),
  terms_version text,
  source text not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, country, capability)
);
create index if not exists provider_country_capabilities_org_lookup_idx on public.provider_country_capabilities (organization_id, provider, country, capability);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  external_id text not null,
  order_reference text,
  status text not null check (status in ('pending','paid','partially_refunded','refunded','chargeback','cancelled')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  occurred_at timestamptz not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, provider, external_id)
);
create index if not exists sales_org_occurred_idx on public.sales (organization_id, occurred_at desc);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null,
  product_id uuid,
  offer_id uuid,
  provider text not null,
  external_id text not null,
  quantity integer not null check (quantity > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  unit_amount_minor bigint not null check (unit_amount_minor >= 0),
  total_amount_minor bigint not null check (total_amount_minor >= 0),
  created_at timestamptz not null default now(),
  unique (organization_id, provider, external_id),
  foreign key (organization_id, sale_id) references public.sales(organization_id, id) on delete cascade,
  foreign key (organization_id, product_id) references public.commerce_products(organization_id, id) on delete set null,
  foreign key (organization_id, offer_id) references public.commerce_offers(organization_id, id) on delete set null
);
create index if not exists sale_items_org_sale_idx on public.sale_items (organization_id, sale_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null,
  provider text not null,
  external_id text not null,
  status text not null check (status in ('pending','authorized','paid','failed','cancelled','refunded')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  created_at timestamptz not null default now(),
  unique (organization_id, provider, external_id),
  foreign key (organization_id, sale_id) references public.sales(organization_id, id) on delete cascade
);
create index if not exists payments_org_sale_idx on public.payments (organization_id, sale_id, occurred_at desc);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null,
  provider text not null,
  external_id text not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reason text,
  occurred_at timestamptz not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  created_at timestamptz not null default now(),
  unique (organization_id, provider, external_id),
  foreign key (organization_id, sale_id) references public.sales(organization_id, id) on delete cascade
);
create index if not exists refunds_org_sale_idx on public.refunds (organization_id, sale_id, occurred_at desc);

create table if not exists public.chargebacks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid not null,
  provider text not null,
  external_id text not null,
  status text not null check (status in ('opened','won','lost','reversed')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  created_at timestamptz not null default now(),
  unique (organization_id, provider, external_id),
  foreign key (organization_id, sale_id) references public.sales(organization_id, id) on delete cascade
);
create index if not exists chargebacks_org_sale_idx on public.chargebacks (organization_id, sale_id, occurred_at desc);

create table if not exists public.affiliate_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  external_id text not null,
  name text not null,
  status text not null default 'active' check (status in ('active','paused','closed')),
  commission_bps integer check (commission_bps is null or commission_bps between 0 and 10000),
  currency text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, provider, external_id)
);

create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null,
  creator_profile_id uuid,
  offer_id uuid,
  provider text not null,
  external_id text not null,
  destination_url text not null,
  click_id_parameter text,
  sub_id_parameter text,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, provider, external_id),
  foreign key (organization_id, program_id) references public.affiliate_programs(organization_id, id) on delete cascade,
  foreign key (organization_id, creator_profile_id) references public.creator_profiles(organization_id, id) on delete set null,
  foreign key (organization_id, offer_id) references public.commerce_offers(organization_id, id) on delete set null
);

create table if not exists public.affiliate_conversions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null,
  affiliate_link_id uuid,
  sale_id uuid,
  provider text not null,
  external_id text not null,
  status text not null check (status in ('observed','pending','confirmed','reversed')),
  amount_minor bigint,
  currency text,
  occurred_at timestamptz not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, provider, external_id),
  foreign key (organization_id, program_id) references public.affiliate_programs(organization_id, id) on delete cascade,
  foreign key (organization_id, affiliate_link_id) references public.affiliate_links(organization_id, id) on delete set null,
  foreign key (organization_id, sale_id) references public.sales(organization_id, id) on delete set null
);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  affiliate_conversion_id uuid,
  provider text not null,
  external_id text not null,
  status text not null default 'pending' check (status in ('pending','approved','reversed','paid')),
  amount_minor bigint not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  approved_at timestamptz,
  paid_at timestamptz,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, provider, external_id),
  foreign key (organization_id, affiliate_conversion_id) references public.affiliate_conversions(organization_id, id) on delete set null
);
create index if not exists commissions_org_status_idx on public.commissions (organization_id, status, occurred_at desc);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid,
  provider text not null,
  external_id text not null,
  status text not null check (status in ('pending','processing','paid','failed','reversed')),
  amount_minor bigint not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  created_at timestamptz not null default now(),
  unique (organization_id, provider, external_id),
  foreign key (organization_id, program_id) references public.affiliate_programs(organization_id, id) on delete set null
);

create table if not exists public.attributions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id uuid,
  affiliate_conversion_id uuid,
  creator_profile_id uuid,
  product_id uuid,
  offer_id uuid,
  campaign_id uuid,
  creative_variant_id uuid,
  conversion_id text not null,
  attribution_model text not null check (attribution_model in ('exact_identifier','utm','unattributed')),
  confidence_bps integer not null check (confidence_bps between 0 and 10000),
  evidence_refs jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_refs) = 'array'),
  created_at timestamptz not null default now(),
  unique (organization_id, conversion_id, attribution_model),
  foreign key (organization_id, sale_id) references public.sales(organization_id, id) on delete set null,
  foreign key (organization_id, affiliate_conversion_id) references public.affiliate_conversions(organization_id, id) on delete set null,
  foreign key (organization_id, creator_profile_id) references public.creator_profiles(organization_id, id) on delete set null,
  foreign key (organization_id, product_id) references public.commerce_products(organization_id, id) on delete set null,
  foreign key (organization_id, offer_id) references public.commerce_offers(organization_id, id) on delete set null,
  foreign key (organization_id, campaign_id) references public.commerce_campaigns(organization_id, id) on delete set null,
  foreign key (organization_id, creative_variant_id) references public.creative_variants(organization_id, id) on delete set null
);
create index if not exists attributions_org_conversion_idx on public.attributions (organization_id, conversion_id);

create table if not exists public.revenue_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  gmv_minor bigint not null default 0,
  gross_revenue_minor bigint not null default 0,
  net_revenue_minor bigint not null default 0,
  refund_minor bigint not null default 0,
  chargeback_minor bigint not null default 0,
  commission_pending_minor bigint not null default 0,
  commission_approved_minor bigint not null default 0,
  commission_paid_minor bigint not null default 0,
  dimensions jsonb not null default '{}'::jsonb check (jsonb_typeof(dimensions) = 'object'),
  generated_at timestamptz not null default now(),
  check (period_end > period_start)
);
create index if not exists revenue_snapshots_org_period_idx on public.revenue_snapshots (organization_id, period_start desc, period_end desc);

create table if not exists public.revenue_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric text not null,
  target_amount_minor bigint,
  target_value numeric(20,6),
  currency text,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  created_at timestamptz not null default now(),
  check (period_end > period_start),
  check (target_amount_minor is not null or target_value is not null)
);

create table if not exists public.commerce_experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid,
  name text not null,
  hypothesis text not null,
  primary_metric text not null,
  minimum_sample_size integer not null default 20 check (minimum_sample_size > 0),
  minimum_window_seconds integer not null default 86400 check (minimum_window_seconds > 0),
  status text not null default 'draft' check (status in ('draft','running','paused','completed','cancelled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, campaign_id) references public.commerce_campaigns(organization_id, id) on delete set null
);
create index if not exists commerce_experiments_org_status_idx on public.commerce_experiments (organization_id, status, updated_at desc);

create table if not exists public.commerce_experiment_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  experiment_id uuid not null,
  creative_variant_id uuid,
  key text not null,
  allocation_bps integer not null check (allocation_bps between 0 and 10000),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  created_at timestamptz not null default now(),
  unique (organization_id, experiment_id, key),
  foreign key (organization_id, experiment_id) references public.commerce_experiments(organization_id, id) on delete cascade,
  foreign key (organization_id, creative_variant_id) references public.creative_variants(organization_id, id) on delete set null
);

-- Tenant RLS. Operational financial facts are read-only to authenticated clients;
-- trusted service-role writes must still carry explicit organization_id filters.
alter table public.creator_profiles enable row level security;
create policy creator_profiles_tenant_all on public.creator_profiles for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_products enable row level security;
create policy commerce_products_tenant_all on public.commerce_products for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_offers enable row level security;
create policy commerce_offers_tenant_all on public.commerce_offers for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_campaigns enable row level security;
create policy commerce_campaigns_tenant_all on public.commerce_campaigns for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.creative_variants enable row level security;
create policy creative_variants_tenant_all on public.creative_variants for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.provider_country_capabilities enable row level security;
create policy provider_country_capabilities_tenant_all on public.provider_country_capabilities for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));

alter table public.sales enable row level security;
create policy sales_tenant_select on public.sales for select to authenticated using (organization_id in (select public.fn_user_org_ids()));
alter table public.sale_items enable row level security;
create policy sale_items_tenant_select on public.sale_items for select to authenticated using (organization_id in (select public.fn_user_org_ids()));
alter table public.payments enable row level security;
create policy payments_tenant_select on public.payments for select to authenticated using (organization_id in (select public.fn_user_org_ids()));
alter table public.refunds enable row level security;
create policy refunds_tenant_select on public.refunds for select to authenticated using (organization_id in (select public.fn_user_org_ids()));
alter table public.chargebacks enable row level security;
create policy chargebacks_tenant_select on public.chargebacks for select to authenticated using (organization_id in (select public.fn_user_org_ids()));

alter table public.affiliate_programs enable row level security;
create policy affiliate_programs_tenant_all on public.affiliate_programs for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.affiliate_links enable row level security;
create policy affiliate_links_tenant_all on public.affiliate_links for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.affiliate_conversions enable row level security;
create policy affiliate_conversions_tenant_select on public.affiliate_conversions for select to authenticated using (organization_id in (select public.fn_user_org_ids()));
alter table public.commissions enable row level security;
create policy commissions_tenant_select on public.commissions for select to authenticated using (organization_id in (select public.fn_user_org_ids()));
alter table public.payouts enable row level security;
create policy payouts_tenant_select on public.payouts for select to authenticated using (organization_id in (select public.fn_user_org_ids()));
alter table public.attributions enable row level security;
create policy attributions_tenant_select on public.attributions for select to authenticated using (organization_id in (select public.fn_user_org_ids()));
alter table public.revenue_snapshots enable row level security;
create policy revenue_snapshots_tenant_select on public.revenue_snapshots for select to authenticated using (organization_id in (select public.fn_user_org_ids()));
alter table public.revenue_goals enable row level security;
create policy revenue_goals_tenant_all on public.revenue_goals for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_experiments enable row level security;
create policy commerce_experiments_tenant_all on public.commerce_experiments for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
alter table public.commerce_experiment_variants enable row level security;
create policy commerce_experiment_variants_tenant_all on public.commerce_experiment_variants for all to authenticated using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));

grant select, insert, update, delete on public.creator_profiles, public.commerce_products, public.commerce_offers, public.commerce_campaigns, public.creative_variants, public.provider_country_capabilities, public.affiliate_programs, public.affiliate_links, public.revenue_goals, public.commerce_experiments, public.commerce_experiment_variants to authenticated;
grant select on public.sales, public.sale_items, public.payments, public.refunds, public.chargebacks, public.affiliate_conversions, public.commissions, public.payouts, public.attributions, public.revenue_snapshots to authenticated;
grant all on public.creator_profiles, public.commerce_products, public.commerce_offers, public.commerce_campaigns, public.creative_variants, public.provider_country_capabilities, public.sales, public.sale_items, public.payments, public.refunds, public.chargebacks, public.affiliate_programs, public.affiliate_links, public.affiliate_conversions, public.commissions, public.payouts, public.attributions, public.revenue_snapshots, public.revenue_goals, public.commerce_experiments, public.commerce_experiment_variants to service_role;

notify pgrst, 'reload schema';
