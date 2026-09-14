-- Wave 10 delivery proof hardening.
-- Adds the durable receipt table used by DeliveryReceiptStore and aligns the
-- Wave 9/10 state RLS with the repository's canonical organization helpers.

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
  primary key (tenant_id, delivery_receipt_id),
  constraint delivery_receipts_tenant_matches_organization
    check (tenant_id = organization_id),
  constraint delivery_receipts_artifact_refs_array
    check (jsonb_typeof(artifact_refs) = 'array' and jsonb_array_length(artifact_refs) > 0),
  constraint delivery_receipts_evidence_refs_array
    check (jsonb_typeof(evidence_refs) = 'array' and jsonb_array_length(evidence_refs) > 0),
  constraint delivery_receipts_environment_check
    check (environment in ('LOCAL', 'STAGING', 'PRODUCTION')),
  constraint delivery_receipts_channel_check
    check (channel in ('WEB_PREVIEW', 'MOBILE_PREVIEW', 'APP_STORE', 'PLAY_STORE', 'MANAGED_SERVICE')),
  constraint delivery_receipts_result_check
    check (result in ('HANDED_OFF', 'AVAILABLE', 'ROLLED_BACK', 'FAILED', 'NOT_PROVEN')),
  constraint delivery_receipts_content_hash_check
    check (content_hash ~ '^[0-9a-f]{64}$')
);

-- Receipt IDs are globally unique because the application deliberately rejects
-- cross-tenant reuse. This also closes the concurrent cross-tenant race at DB level.
create unique index if not exists delivery_receipts_global_id_unique
  on public.delivery_receipts (delivery_receipt_id);

create index if not exists delivery_receipts_tenant_plan_created_idx
  on public.delivery_receipts (tenant_id, delivery_plan_id, created_at desc);

alter table public.delivery_receipts enable row level security;

drop policy if exists delivery_receipts_tenant_select on public.delivery_receipts;
create policy delivery_receipts_tenant_select on public.delivery_receipts
  for select to authenticated
  using (
    public.fn_is_platform_admin()
    or tenant_id in (select public.fn_user_org_ids()::text)
  );

-- Receipts are append-only audit evidence. Writes are expected through trusted
-- server/service-role code; authenticated clients do not get update/delete rights.
revoke update, delete on public.delivery_receipts from anon, authenticated;

-- Forward-fix the branch-local build_plan_state policy. The previous policy
-- depended on app.tenant_id, which is not the repository's canonical auth/RLS
-- mechanism and would make normal authenticated sessions fail closed unexpectedly.
alter table public.build_plan_state enable row level security;
drop policy if exists build_plan_state_tenant_isolation on public.build_plan_state;
drop policy if exists build_plan_state_tenant_select on public.build_plan_state;
drop policy if exists build_plan_state_tenant_write on public.build_plan_state;

create policy build_plan_state_tenant_select on public.build_plan_state
  for select to authenticated
  using (
    public.fn_is_platform_admin()
    or tenant_id in (select public.fn_user_org_ids()::text)
  );

create policy build_plan_state_tenant_write on public.build_plan_state
  for all to authenticated
  using (
    public.fn_is_platform_admin()
    or tenant_id in (select public.fn_user_org_ids()::text)
  )
  with check (
    public.fn_is_platform_admin()
    or tenant_id in (select public.fn_user_org_ids()::text)
  );
