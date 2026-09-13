CREATE TABLE IF NOT EXISTS public.command_center_overviews (
  organization_id text PRIMARY KEY,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.command_center_overviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS command_center_overviews_tenant_all ON public.command_center_overviews;
CREATE POLICY command_center_overviews_tenant_all
  ON public.command_center_overviews FOR ALL
  USING (organization_id IN (SELECT public.fn_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.fn_user_org_ids()));
