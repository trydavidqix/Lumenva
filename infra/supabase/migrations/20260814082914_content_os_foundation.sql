-- Content OS Foundation — local source of truth for intelligence, creation,
-- media, distribution, and learning. External providers are references only.

create table if not exists public.content_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  source_type text not null,
  name text not null,
  configuration jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'disabled', 'failed')),
  external_ref text,
  last_collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, name)
);

create table if not exists public.content_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.content_sources(id) on delete cascade,
  provider text not null,
  external_id text not null,
  raw_hash text not null,
  source_url text,
  title text not null,
  body text,
  published_at timestamptz,
  observed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, source_id, external_id)
);

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  website_url text,
  notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.competitor_monitors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  provider text not null,
  monitor_type text not null,
  target_url text not null,
  provider_monitor_id text,
  configuration jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'active', 'disabled', 'failed')),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, competitor_id, provider, monitor_type, target_url),
  unique nulls not distinct (organization_id, provider, provider_monitor_id)
);

create table if not exists public.competitor_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  competitor_id uuid not null references public.competitors(id) on delete cascade,
  monitor_id uuid not null references public.competitor_monitors(id) on delete cascade,
  external_id text not null,
  event_type text not null,
  title text not null,
  summary text,
  occurred_at timestamptz,
  observed_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, monitor_id, external_id)
);

create table if not exists public.content_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  signal_id uuid references public.content_signals(id) on delete set null,
  competitor_event_id uuid references public.competitor_events(id) on delete set null,
  title text not null,
  rationale text,
  priority smallint not null default 0 check (priority between 0 and 100),
  status text not null default 'new' check (status in ('new', 'accepted', 'rejected', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (signal_id is not null or competitor_event_id is not null)
);

create table if not exists public.content_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  objective text,
  description text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  starts_at timestamptz,
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.content_campaigns(id) on delete set null,
  opportunity_id uuid references public.content_opportunities(id) on delete set null,
  title text not null,
  brief text,
  audience text,
  angle text,
  status text not null default 'draft' check (status in ('draft', 'ready', 'archived')),
  score numeric(5,2) check (score between 0 and 100),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_hooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  idea_id uuid not null references public.content_ideas(id) on delete cascade,
  hook_text text not null,
  variant text not null default 'primary',
  score numeric(5,2) check (score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idea_id, variant)
);

create table if not exists public.content_scripts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  idea_id uuid not null references public.content_ideas(id) on delete cascade,
  hook_id uuid references public.content_hooks(id) on delete set null,
  title text not null,
  body jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'rejected', 'archived')),
  version integer not null default 1 check (version > 0),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idea_id, version),
  check ((status = 'approved') = (approved_at is not null))
);

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.content_campaigns(id) on delete set null,
  idea_id uuid references public.content_ideas(id) on delete set null,
  script_id uuid references public.content_scripts(id) on delete set null,
  content_type text not null,
  title text not null,
  body jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'scheduled', 'published', 'archived')),
  scheduled_for timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  notes text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('approved', 'rejected')) = (decided_at is not null))
);

create table if not exists public.content_creators (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  creator_type text not null check (creator_type in ('person', 'brand', 'ai')),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.content_creator_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  creator_id uuid not null references public.content_creators(id) on delete cascade,
  platform text not null,
  handle text not null,
  profile_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, platform, handle)
);

create table if not exists public.content_creator_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  creator_id uuid not null references public.content_creators(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  assignment_role text not null,
  status text not null default 'assigned' check (status in ('assigned', 'accepted', 'completed', 'cancelled')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, creator_id, content_item_id, assignment_role)
);

create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  asset_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  checksum text,
  origin_provider text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, storage_bucket, storage_path)
);

create table if not exists public.creative_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  provider text not null,
  operation text not null,
  request_hash text not null,
  idempotency_key text not null,
  provider_job_id text,
  state text not null default 'queued' check (state in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  parameters jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  last_error_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancel_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  unique nulls not distinct (organization_id, provider, provider_job_id)
);

create table if not exists public.creative_job_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  creative_job_id uuid not null references public.creative_jobs(id) on delete cascade,
  asset_id uuid not null references public.content_assets(id) on delete cascade,
  asset_role text not null check (asset_role in ('input', 'output')),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, creative_job_id, asset_id, asset_role)
);

create table if not exists public.distribution_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  provider_connection_id text,
  display_name text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'failed', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, display_name),
  unique nulls not distinct (organization_id, provider, provider_connection_id)
);

create table if not exists public.publication_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  connection_id uuid not null references public.distribution_connections(id) on delete restrict,
  idempotency_key text not null,
  request_hash text not null,
  provider_publication_id text,
  state text not null default 'queued' check (state in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  scheduled_for timestamptz,
  published_at timestamptz,
  published_url text,
  attempts integer not null default 0 check (attempts >= 0),
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  unique nulls not distinct (organization_id, connection_id, provider_publication_id)
);

create table if not exists public.publication_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  publication_job_id uuid not null references public.publication_jobs(id) on delete cascade,
  provider_ref text,
  captured_at timestamptz not null,
  metrics jsonb not null default '{}'::jsonb,
  source_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, publication_job_id, captured_at)
);

create table if not exists public.content_learning_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  publication_job_id uuid references public.publication_jobs(id) on delete set null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (content_item_id is not null or publication_job_id is not null)
);

create index if not exists content_sources_active_idx on public.content_sources (organization_id, provider) where status = 'active';
create index if not exists content_signals_observed_idx on public.content_signals (organization_id, observed_at desc);
create index if not exists competitor_monitors_active_idx on public.competitor_monitors (organization_id, provider) where status = 'active';
create index if not exists competitor_events_observed_idx on public.competitor_events (organization_id, observed_at desc);

-- Enforce tenant ownership at the relational boundary, including direct SQL/service-role writes.
create or replace function public.content_os_enforce_tenant_fk()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_org uuid;
begin
  if to_jsonb(NEW)->>TG_ARGV[1] is null then return NEW; end if;
  execute format('select organization_id from public.%I where id = $1', TG_ARGV[0])
    into parent_org using (to_jsonb(NEW)->>TG_ARGV[1])::uuid;
  if parent_org is null or parent_org <> NEW.organization_id then
    raise exception 'content_os tenant mismatch: %.%', TG_TABLE_NAME, TG_ARGV[1]
      using errcode = '23514';
  end if;
  return NEW;
end $$;

drop trigger if exists content_signals_source_tenant on public.content_signals;
create trigger content_signals_source_tenant
  before insert or update on public.content_signals for each row execute function public.content_os_enforce_tenant_fk('content_sources', 'source_id');
drop trigger if exists competitor_monitors_competitor_tenant on public.competitor_monitors;
create trigger competitor_monitors_competitor_tenant
  before insert or update on public.competitor_monitors for each row execute function public.content_os_enforce_tenant_fk('competitors', 'competitor_id');
drop trigger if exists competitor_events_competitor_tenant on public.competitor_events;
create trigger competitor_events_competitor_tenant
  before insert or update on public.competitor_events for each row execute function public.content_os_enforce_tenant_fk('competitors', 'competitor_id');
drop trigger if exists competitor_events_monitor_tenant on public.competitor_events;
create trigger competitor_events_monitor_tenant
  before insert or update on public.competitor_events for each row execute function public.content_os_enforce_tenant_fk('competitor_monitors', 'monitor_id');
drop trigger if exists content_opportunities_signal_tenant on public.content_opportunities;
create trigger content_opportunities_signal_tenant
  before insert or update on public.content_opportunities for each row execute function public.content_os_enforce_tenant_fk('content_signals', 'signal_id');
drop trigger if exists content_opportunities_event_tenant on public.content_opportunities;
create trigger content_opportunities_event_tenant
  before insert or update on public.content_opportunities for each row execute function public.content_os_enforce_tenant_fk('competitor_events', 'competitor_event_id');
drop trigger if exists content_ideas_campaign_tenant on public.content_ideas;
create trigger content_ideas_campaign_tenant
  before insert or update on public.content_ideas for each row execute function public.content_os_enforce_tenant_fk('content_campaigns', 'campaign_id');
drop trigger if exists content_ideas_opportunity_tenant on public.content_ideas;
create trigger content_ideas_opportunity_tenant
  before insert or update on public.content_ideas for each row execute function public.content_os_enforce_tenant_fk('content_opportunities', 'opportunity_id');
create trigger content_scripts_idea_tenant before insert or update on public.content_scripts for each row execute function public.content_os_enforce_tenant_fk('content_ideas', 'idea_id');
create trigger content_scripts_hook_tenant before insert or update on public.content_scripts for each row execute function public.content_os_enforce_tenant_fk('content_hooks', 'hook_id');
create trigger content_items_campaign_tenant before insert or update on public.content_items for each row execute function public.content_os_enforce_tenant_fk('content_campaigns', 'campaign_id');
create trigger content_items_idea_tenant before insert or update on public.content_items for each row execute function public.content_os_enforce_tenant_fk('content_ideas', 'idea_id');
create trigger content_items_script_tenant before insert or update on public.content_items for each row execute function public.content_os_enforce_tenant_fk('content_scripts', 'script_id');
create trigger content_approvals_item_tenant before insert or update on public.content_approvals for each row execute function public.content_os_enforce_tenant_fk('content_items', 'content_item_id');
create trigger creator_profiles_creator_tenant before insert or update on public.content_creator_profiles for each row execute function public.content_os_enforce_tenant_fk('content_creators', 'creator_id');
create trigger creator_assignments_creator_tenant before insert or update on public.content_creator_assignments for each row execute function public.content_os_enforce_tenant_fk('content_creators', 'creator_id');
create trigger creator_assignments_item_tenant before insert or update on public.content_creator_assignments for each row execute function public.content_os_enforce_tenant_fk('content_items', 'content_item_id');
create index if not exists content_opportunities_status_idx on public.content_opportunities (organization_id, status, priority desc);
create index if not exists content_ideas_campaign_idx on public.content_ideas (organization_id, campaign_id, created_at desc);
create index if not exists content_items_status_idx on public.content_items (organization_id, status, scheduled_for);
create index if not exists content_approvals_pending_idx on public.content_approvals (organization_id, content_item_id) where status = 'pending';
create index if not exists content_creator_assignments_item_idx on public.content_creator_assignments (organization_id, content_item_id);
create index if not exists content_assets_item_idx on public.content_assets (organization_id, content_item_id);
create index if not exists creative_jobs_reconcile_idx on public.creative_jobs (organization_id, provider, state, updated_at) where state in ('queued', 'running', 'failed');
create index if not exists publication_jobs_reconcile_idx on public.publication_jobs (organization_id, connection_id, state, scheduled_for) where state in ('queued', 'running', 'failed');
create index if not exists publication_metrics_job_idx on public.publication_metrics (organization_id, publication_job_id, captured_at desc);
create index if not exists content_learning_events_occurred_idx on public.content_learning_events (organization_id, occurred_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'content_sources', 'content_signals', 'competitors', 'competitor_monitors',
    'competitor_events', 'content_opportunities', 'content_campaigns',
    'content_ideas', 'content_hooks', 'content_scripts', 'content_items',
    'content_approvals', 'content_creators', 'content_creator_profiles',
    'content_creator_assignments', 'content_assets', 'creative_jobs',
    'creative_job_assets', 'distribution_connections', 'publication_jobs',
    'publication_metrics', 'content_learning_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists tenant_isolation_%s_all on public.%I', table_name, table_name);
    execute format(
      'create policy tenant_isolation_%s_all on public.%I for all to authenticated using ((organization_id in (select * from public.fn_user_org_ids())) or public.fn_is_platform_admin()) with check ((organization_id in (select * from public.fn_user_org_ids())) or public.fn_is_platform_admin())',
      table_name,
      table_name
    );
    execute format(
      'drop trigger if exists %I on public.%I',
      'trg_' || table_name || '_touch',
      table_name
    );
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.fn_touch_updated_at()',
      'trg_' || table_name || '_touch',
      table_name
    );
  end loop;
end $$;
