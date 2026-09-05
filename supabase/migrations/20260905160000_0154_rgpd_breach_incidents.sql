-- J3 RGPD breach register. Additive-only, no historical import.
create table if not exists public.rgpd_breach_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  known_at timestamptz not null,
  risk_level text not null check (risk_level in ('none','low','high','unknown')),
  deadline_at timestamptz not null,
  notification_decision text not null check (notification_decision in ('notify','not_notify','not_notifiable_documented','pending')),
  notified_at timestamptz,
  cnpd_evidence_url text,
  data_subject_notified_at timestamptz,
  escalation_owner uuid references auth.users(id),
  escalation_notes text,
  evidence jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index if not exists rgpd_breach_incidents_deadline_idx on public.rgpd_breach_incidents(organization_id, deadline_at);
alter table public.rgpd_breach_incidents enable row level security;
revoke all on public.rgpd_breach_incidents from anon, authenticated;
grant select, insert, update on public.rgpd_breach_incidents to authenticated;
grant all on public.rgpd_breach_incidents to service_role;
drop policy if exists rgpd_breach_incidents_select on public.rgpd_breach_incidents;
create policy rgpd_breach_incidents_select on public.rgpd_breach_incidents for select using (organization_id in (select public.fn_user_org_ids()));
drop policy if exists rgpd_breach_incidents_insert on public.rgpd_breach_incidents;
create policy rgpd_breach_incidents_insert on public.rgpd_breach_incidents for insert with check (organization_id in (select public.fn_user_org_ids()));
drop policy if exists rgpd_breach_incidents_update on public.rgpd_breach_incidents;
create policy rgpd_breach_incidents_update on public.rgpd_breach_incidents for update using (organization_id in (select public.fn_user_org_ids())) with check (organization_id in (select public.fn_user_org_ids()));
