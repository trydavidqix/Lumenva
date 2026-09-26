-- J1 RGPD state machine. Additive-only; legacy status remains authoritative while
-- RGPD_STATE_MACHINE_V1 is disabled. No existing rows are rewritten here.
alter table public.lgpd_requests
  add column if not exists rgpd_status text,
  add column if not exists extension_reason text,
  add column if not exists extension_notified_at timestamptz,
  add column if not exists refusal_grounds text,
  add column if not exists refusal_communicated_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lgpd_requests_rgpd_status_check') then
    alter table public.lgpd_requests
      add constraint lgpd_requests_rgpd_status_check
      check (rgpd_status is null or rgpd_status = any (array['received','in_review','extension_notified','responded','refused']));
  end if;
end $$;

create index if not exists lgpd_requests_org_rgpd_status_idx
  on public.lgpd_requests (organization_id, rgpd_status);

-- Idempotent, deterministic backfill. Legacy status is preserved unchanged.
update public.lgpd_requests
set rgpd_status = case status
  when 'received' then 'received'
  when 'processing' then 'in_review'
  when 'completed' then 'responded'
  when 'failed' then 'refused'
  when 'expired' then 'refused'
  else null
end
where rgpd_status is null;

comment on column public.lgpd_requests.rgpd_status is
  'RGPD J1 state machine; nullable during dual-read compatibility rollout.';
comment on column public.lgpd_requests.extension_reason is
  'RGPD Art. 12(3) extension justification; required with extension_notified_at.';
comment on column public.lgpd_requests.extension_notified_at is
  'UTC timestamp when the extension was communicated to the data subject.';
comment on column public.lgpd_requests.refusal_grounds is
  'RGPD legal grounds communicated for refusing a request.';
comment on column public.lgpd_requests.refusal_communicated_at is
  'UTC timestamp when refusal grounds were communicated to the data subject.';
