-- Tenant-controlled, fail-closed delivery policy and voice safeguards.
create table if not exists public.notification_delivery_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  voice_escalation_enabled boolean not null default false,
  allowed_voice_destinations text[] not null default '{}'::text[],
  whatsapp_max_attempts smallint not null default 2 check (whatsapp_max_attempts between 1 and 10),
  voice_max_attempts smallint not null default 1 check (voice_max_attempts between 1 and 5),
  max_voice_calls_per_hour smallint not null default 2 check (max_voice_calls_per_hour between 0 and 100),
  max_voice_calls_per_day smallint not null default 4 check (max_voice_calls_per_day between 0 and 500),
  voice_cooldown_seconds integer not null default 600 check (voice_cooldown_seconds between 0 and 86400),
  quiet_hours_start time null,
  quiet_hours_end time null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_delivery_policies_quiet_hours_pair
    check (
      (quiet_hours_start is null and quiet_hours_end is null)
      or (quiet_hours_start is not null and quiet_hours_end is not null)
    )
);

alter table public.notification_delivery_policies enable row level security;
drop policy if exists notification_delivery_policies_select_org on public.notification_delivery_policies;
create policy notification_delivery_policies_select_org
  on public.notification_delivery_policies for select to authenticated
  using (organization_id in (select public.fn_user_org_ids()));
drop policy if exists notification_delivery_policies_insert_org on public.notification_delivery_policies;
create policy notification_delivery_policies_insert_org
  on public.notification_delivery_policies for insert to authenticated
  with check (
    public.fn_is_platform_admin()
    or (
      organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'manager')
    )
  );
drop policy if exists notification_delivery_policies_update_org on public.notification_delivery_policies;
create policy notification_delivery_policies_update_org
  on public.notification_delivery_policies for update to authenticated
  using (
    public.fn_is_platform_admin()
    or (
      organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'manager')
    )
  )
  with check (
    public.fn_is_platform_admin()
    or (
      organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'manager')
    )
  );
drop policy if exists notification_delivery_policies_delete_org on public.notification_delivery_policies;
create policy notification_delivery_policies_delete_org
  on public.notification_delivery_policies for delete to authenticated
  using (
    public.fn_is_platform_admin()
    or (
      organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'manager')
    )
  );

revoke all on table public.notification_delivery_policies from public, anon;
grant select, insert, update, delete on table public.notification_delivery_policies to authenticated;
grant all on table public.notification_delivery_policies to service_role;

comment on table public.notification_delivery_policies is
  'Per-tenant fail-closed delivery controls: exact E.164 allowlist, quiet hours, cooldown and rate limits.';
comment on column public.notification_delivery_policies.allowed_voice_destinations is
  'Only exact E.164 destinations explicitly allowed for voice escalation; empty disables outbound voice.';
