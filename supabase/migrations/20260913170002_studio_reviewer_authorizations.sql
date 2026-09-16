CREATE TABLE IF NOT EXISTS public.studio_reviewer_authorizations (
  organization_id uuid NOT NULL,
  reviewer_id text NOT NULL CHECK (btrim(reviewer_id) <> ''),
  role text NOT NULL CHECK (role IN ('owner','manager','reviewer')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, reviewer_id)
);

ALTER TABLE public.studio_reviewer_authorizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS studio_reviewer_authorizations_tenant_all ON public.studio_reviewer_authorizations;
CREATE POLICY studio_reviewer_authorizations_tenant_all
  ON public.studio_reviewer_authorizations FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.fn_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.fn_user_org_ids()));

GRANT SELECT ON public.studio_reviewer_authorizations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.studio_reviewer_authorizations TO service_role;
