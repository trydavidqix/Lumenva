CREATE TABLE IF NOT EXISTS public.hermes_memory_records (
  organization_id text NOT NULL,
  record_id text NOT NULL,
  backend text NOT NULL,
  subject text NOT NULL,
  scope text NOT NULL,
  namespace text NOT NULL CHECK (namespace ~ '^(owner|home|company):[^:]+$'),
  content jsonb NOT NULL,
  observed_at timestamptz NOT NULL,
  confidence double precision NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  supersedes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, record_id, backend)
);
ALTER TABLE public.hermes_memory_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hermes_memory_records_tenant_all ON public.hermes_memory_records;
CREATE POLICY hermes_memory_records_tenant_all ON public.hermes_memory_records FOR ALL TO authenticated USING (organization_id IN (SELECT public.fn_user_org_ids())) WITH CHECK (organization_id IN (SELECT public.fn_user_org_ids()));
GRANT SELECT, INSERT, UPDATE ON public.hermes_memory_records TO authenticated;
