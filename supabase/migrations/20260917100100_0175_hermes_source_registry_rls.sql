ALTER TABLE public.hermes_source_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hermes_source_registry_tenant_isolation ON public.hermes_source_registry;
CREATE POLICY hermes_source_registry_tenant_isolation
  ON public.hermes_source_registry
  FOR ALL
  USING (organization_id IN (SELECT public.fn_user_org_ids()::text))
  WITH CHECK (organization_id IN (SELECT public.fn_user_org_ids()::text));
