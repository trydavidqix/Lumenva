CREATE TABLE IF NOT EXISTS public.psyche_watchdog_observations (
  organization_id text NOT NULL,
  job_id text NOT NULL,
  cycle integer NOT NULL CHECK (cycle >= 1),
  progressed boolean NOT NULL,
  no_progress_cycles integer NOT NULL CHECK (no_progress_cycles >= 0),
  status text NOT NULL CHECK (status IN ('ON_TRACK', 'AT_RISK')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, job_id, cycle)
);
ALTER TABLE public.psyche_watchdog_observations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS psyche_watchdog_observations_tenant_all ON public.psyche_watchdog_observations;
CREATE POLICY psyche_watchdog_observations_tenant_all ON public.psyche_watchdog_observations FOR ALL TO authenticated USING (organization_id IN (SELECT public.fn_user_org_ids())) WITH CHECK (organization_id IN (SELECT public.fn_user_org_ids()));
GRANT SELECT, INSERT, UPDATE ON public.psyche_watchdog_observations TO authenticated;
