CREATE TABLE IF NOT EXISTS public.operating_core_receipts (
  id text primary key check (btrim(id) <> ''),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  execution_id text not null check (btrim(execution_id) <> ''),
  job_id text,
  action text not null check (btrim(action) <> ''),
  status text not null check (status in ('SUCCEEDED','DENIED','FAILED','NOT_PROVEN')),
  actor_id text not null check (btrim(actor_id) <> ''),
  policy_version text not null check (btrim(policy_version) <> ''),
  permission_level text not null check (permission_level in ('P0','P1','P2','P3','P4')),
  risk_level text not null check (risk_level in ('R0','R1','R2','R3','R4')),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  result jsonb not null default '{}'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  contract_version text not null default 'wave1-v1',
  unique (organization_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS operating_core_receipts_job_idx ON public.operating_core_receipts (organization_id, job_id, created_at desc);
ALTER TABLE public.operating_core_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operating_core_receipts_tenant_all ON public.operating_core_receipts;
CREATE POLICY operating_core_receipts_tenant_all ON public.operating_core_receipts FOR ALL TO authenticated USING (organization_id IN (SELECT public.fn_user_org_ids())) WITH CHECK (organization_id IN (SELECT public.fn_user_org_ids()));
GRANT SELECT, INSERT, UPDATE ON public.operating_core_receipts TO authenticated;
GRANT ALL ON public.operating_core_receipts TO service_role;
NOTIFY pgrst, 'reload schema';
