-- 0201 — Notification Router delivery policy / anti-fraud controls.
--
-- Voice is fail-closed per tenant: there is no implicit "call any contact".
-- A tenant must explicitly enable voice escalation and allow exact E.164
-- destinations during rollout. Limits live in data, not source constants, so
-- the self-hoster can tighten them without a deploy.

create table if not exists public.notification_delivery_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  voice_escalation_enabled boolean not null default false,
  allowed_voice_destinations text[] not null default '{}'::text[],
  whatsapp_max_attempts smallint not null default 2
    check (whatsapp_max_attempts between 1 and 10),
  voice_max_attempts smallint not null default 1
    check (voice_max_attempts between 1 and 5),
  max_voice_calls_per_hour smallint not null default 2
    check (max_voice_calls_per_hour between 0 and 100),
  max_voice_calls_per_day smallint not null default 4
    check (max_voice_calls_per_day between 0 and 500),
  voice_cooldown_seconds integer not null default 600
    check (voice_cooldown_seconds between 0 and 86400),
  quiet_hours_start time null,
  quiet_hours_end time null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_delivery_policies_quiet_hours_pair
    check (
      (quiet_hours_start is null and quiet_hours_end is null)
      or
      (quiet_hours_start is not null and quiet_hours_end is not null)
    )
);

alter table public.notification_delivery_policies enable row level security;

drop policy if exists notification_delivery_policies_select_org
  on public.notification_delivery_policies;
create policy notification_delivery_policies_select_org
  on public.notification_delivery_policies
  for select to authenticated
  using (organization_id in (select public.fn_user_org_ids()));

drop policy if exists notification_delivery_policies_insert_org
  on public.notification_delivery_policies;
create policy notification_delivery_policies_insert_org
  on public.notification_delivery_policies
  for insert to authenticated
  with check (organization_id in (select public.fn_user_org_ids()));

drop policy if exists notification_delivery_policies_update_org
  on public.notification_delivery_policies;
create policy notification_delivery_policies_update_org
  on public.notification_delivery_policies
  for update to authenticated
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

drop policy if exists notification_delivery_policies_delete_org
  on public.notification_delivery_policies;
create policy notification_delivery_policies_delete_org
  on public.notification_delivery_policies
  for delete to authenticated
  using (organization_id in (select public.fn_user_org_ids()));

comment on table public.notification_delivery_policies is
  'Per-tenant fail-closed Notification Router policy: exact destination allowlist, retry ceilings, quiet hours, cooldown and voice call rate limits. No provider credentials.';

comment on column public.notification_delivery_policies.allowed_voice_destinations is
  'Exact E.164 destinations explicitly authorized for voice escalation. Empty means no outbound voice destination is permitted.';
