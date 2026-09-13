CREATE TABLE IF NOT EXISTS public.resource_router_workers (
  tenant_id text NOT NULL, agent_id text NOT NULL, surface text NOT NULL,
  capabilities jsonb NOT NULL, current_load numeric NOT NULL, capacity numeric NOT NULL,
  healthy boolean NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, agent_id)
);
CREATE TABLE IF NOT EXISTS public.resource_router_reroutes (
  tenant_id text NOT NULL, task_id text NOT NULL, reroute_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, task_id, reroute_key)
);
ALTER TABLE public.resource_router_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_router_reroutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS resource_router_workers_tenant_all ON public.resource_router_workers;
DROP POLICY IF EXISTS resource_router_reroutes_tenant_all ON public.resource_router_reroutes;
CREATE POLICY resource_router_workers_tenant_all ON public.resource_router_workers FOR ALL USING (tenant_id IN (SELECT public.fn_user_org_ids())) WITH CHECK (tenant_id IN (SELECT public.fn_user_org_ids()));
CREATE POLICY resource_router_reroutes_tenant_all ON public.resource_router_reroutes FOR ALL USING (tenant_id IN (SELECT public.fn_user_org_ids())) WITH CHECK (tenant_id IN (SELECT public.fn_user_org_ids()));
