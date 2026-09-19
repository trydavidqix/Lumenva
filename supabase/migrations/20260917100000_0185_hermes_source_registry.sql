CREATE TABLE IF NOT EXISTS hermes_source_registry (
  organization_id text NOT NULL,
  source_id text NOT NULL,
  uri text NOT NULL,
  title text NOT NULL,
  owner text NOT NULL,
  license text NOT NULL,
  version text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('project_canonical', 'official_vendor', 'approved_internal', 'external')),
  scope text,
  retrieved_at timestamptz,
  last_verified_at timestamptz,
  content_hash text,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'superseded', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, source_id)
);
CREATE INDEX IF NOT EXISTS hermes_source_registry_org_idx
  ON hermes_source_registry (organization_id, state);
