CREATE TABLE IF NOT EXISTS public.integration_webhook_receipts (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  event_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('PROCESSING','PROCESSED','FAILED')),
  claim_token uuid,
  claimed_at timestamptz,
  completed_at timestamptz DEFAULT now(),
  PRIMARY KEY (organization_id, provider, event_id),
  CONSTRAINT integration_webhook_receipts_state_check CHECK (
    (status = 'PROCESSING' AND claim_token IS NOT NULL AND claimed_at IS NOT NULL AND completed_at IS NULL)
    OR (status = 'PROCESSED' AND claim_token IS NULL AND completed_at IS NOT NULL)
    OR (status = 'FAILED' AND claim_token IS NULL AND completed_at IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.integration_secrets (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  secret_ref text NOT NULL,
  secret_value text NOT NULL,
  allowed_operations text[] NOT NULL,
  allowed_actors text[] NOT NULL,
  revoked_at timestamptz,
  PRIMARY KEY (organization_id, secret_ref)
);

ALTER TABLE public.integration_webhook_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS integration_webhook_receipts_tenant ON public.integration_webhook_receipts;
CREATE POLICY integration_webhook_receipts_tenant ON public.integration_webhook_receipts
  FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.fn_user_org_ids()));
REVOKE ALL ON public.integration_webhook_receipts FROM PUBLIC;
REVOKE ALL ON public.integration_webhook_receipts FROM authenticated;
GRANT SELECT ON public.integration_webhook_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_webhook_receipts TO service_role;

ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS integration_secrets_tenant ON public.integration_secrets;
REVOKE ALL ON public.integration_secrets FROM PUBLIC;
REVOKE ALL ON public.integration_secrets FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_secrets TO service_role;
