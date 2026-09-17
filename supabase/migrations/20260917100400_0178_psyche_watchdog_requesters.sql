CREATE TABLE IF NOT EXISTS public.psyche_watchdog_requesters (
  organization_id text NOT NULL,
  requester_id text NOT NULL,
  permission_level text NOT NULL CHECK (permission_level IN ('P0', 'P1', 'P2', 'P3', 'P4')),
  capabilities jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, requester_id)
);
ALTER TABLE public.psyche_watchdog_requesters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS psyche_watchdog_requesters_tenant_all ON public.psyche_watchdog_requesters;
CREATE POLICY psyche_watchdog_requesters_tenant_all ON public.psyche_watchdog_requesters FOR ALL TO authenticated USING (organization_id IN (SELECT public.fn_user_org_ids()::text)) WITH CHECK (organization_id IN (SELECT public.fn_user_org_ids()::text));
GRANT SELECT, INSERT, UPDATE ON public.psyche_watchdog_requesters TO authenticated;
