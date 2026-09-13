CREATE TABLE IF NOT EXISTS public.operating_core_http_execution_receipts (organization_id uuid NOT NULL, request_id text NOT NULL, tool_name text NOT NULL, actor_id text NOT NULL, outcome text NOT NULL CHECK (outcome IN ('SUCCEEDED','FAILED')), result jsonb NOT NULL, evidence jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (organization_id,request_id,tool_name));
ALTER TABLE public.operating_core_http_execution_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operating_core_http_execution_receipts_tenant_all ON public.operating_core_http_execution_receipts;
CREATE POLICY operating_core_http_execution_receipts_tenant_all ON public.operating_core_http_execution_receipts FOR ALL TO authenticated USING (organization_id IN (SELECT public.fn_user_org_ids())) WITH CHECK (organization_id IN (SELECT public.fn_user_org_ids()));
GRANT SELECT, INSERT, UPDATE ON public.operating_core_http_execution_receipts TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.operating_core_http_execution_receipts TO service_role;
