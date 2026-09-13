-- Wave 10.1 forward-fix: normalize findings and bind child evidence/runtime rows to their tenant report.

create table if not exists public.mobile_compliance_findings (
  tenant_id text not null,
  report_id text not null,
  fingerprint text not null,
  rule_id text not null,
  platform text not null check (platform in ('IOS','ANDROID')),
  store text not null check (store in ('APP_STORE','PLAY_STORE')),
  severity text not null check (severity in ('INFO','LOW','MEDIUM','HIGH','CRITICAL')),
  source text not null check (source in ('STATIC','AI','RUNTIME','METADATA')),
  verification text not null check (verification in ('VERIFIED','MANUAL_REVIEW')),
  title text not null,
  description text not null,
  resource text not null,
  line integer check (line is null or line > 0),
  evidence_refs jsonb not null default '[]'::jsonb,
  autofixable boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (tenant_id, report_id, fingerprint),
  foreign key (tenant_id, report_id)
    references public.mobile_compliance_reports (tenant_id, report_id)
    on delete cascade
);

create index if not exists mobile_compliance_findings_report_idx
  on public.mobile_compliance_findings (tenant_id, report_id, severity);
create index if not exists mobile_compliance_findings_rule_idx
  on public.mobile_compliance_findings (tenant_id, rule_id, created_at desc);

alter table public.mobile_compliance_findings enable row level security;
drop policy if exists mobile_compliance_findings_tenant on public.mobile_compliance_findings;
create policy mobile_compliance_findings_tenant on public.mobile_compliance_findings
  for all to authenticated
  using (tenant_id = current_setting('app.tenant_id', true))
  with check (tenant_id = current_setting('app.tenant_id', true));

-- The initial Guardian migration intentionally created child stores without FKs so it could
-- land safely on branches where reports did not yet exist. From this point on the release
-- evidence graph is referentially closed per tenant/report.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mobile_runtime_reviews_report_fk'
      and conrelid = 'public.mobile_runtime_reviews'::regclass
  ) then
    alter table public.mobile_runtime_reviews
      add constraint mobile_runtime_reviews_report_fk
      foreign key (tenant_id, report_id)
      references public.mobile_compliance_reports (tenant_id, report_id)
      on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'mobile_compliance_evidence_report_fk'
      and conrelid = 'public.mobile_compliance_evidence'::regclass
  ) then
    alter table public.mobile_compliance_evidence
      add constraint mobile_compliance_evidence_report_fk
      foreign key (tenant_id, report_id)
      references public.mobile_compliance_reports (tenant_id, report_id)
      on delete cascade;
  end if;
end $$;

notify pgrst, 'reload schema';
