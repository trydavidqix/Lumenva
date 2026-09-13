CREATE TABLE IF NOT EXISTS public.content_provenance (
  organization_id text NOT NULL,
  content_id text NOT NULL,
  skill text NOT NULL,
  content text NOT NULL,
  source text NOT NULL,
  freshness text NOT NULL CHECK (freshness IN ('current', 'stale', 'unknown')),
  confidence double precision NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  generated_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, content_id)
);

ALTER TABLE public.content_provenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_provenance_tenant_isolation ON public.content_provenance;
CREATE POLICY content_provenance_tenant_isolation
  ON public.content_provenance
  FOR ALL
  USING (organization_id IN (SELECT public.fn_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.fn_user_org_ids()));

CREATE INDEX IF NOT EXISTS content_provenance_org_idx
  ON public.content_provenance (organization_id, generated_at DESC);
