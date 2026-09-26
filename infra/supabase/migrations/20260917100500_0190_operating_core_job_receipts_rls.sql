ALTER TABLE public.operating_core_job_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operating_core_job_receipts_tenant_isolation ON public.operating_core_job_receipts;
CREATE POLICY operating_core_job_receipts_tenant_isolation
  ON public.operating_core_job_receipts
  FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.fn_user_org_ids()::text))
  WITH CHECK (organization_id IN (SELECT public.fn_user_org_ids()::text));
GRANT SELECT, INSERT ON public.operating_core_job_receipts TO authenticated;
