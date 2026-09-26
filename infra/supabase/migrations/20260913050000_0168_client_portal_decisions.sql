CREATE TABLE IF NOT EXISTS studio_client_decisions (
 decision_id text NOT NULL, organization_id text NOT NULL, project_id text NOT NULL, variant_id text,
 token_id text NOT NULL, decision text NOT NULL CHECK(decision IN ('COMMENT','APPROVE','REQUEST_CHANGES')),
 comment_redacted text, actor_ref text NOT NULL, occurred_at timestamptz NOT NULL,
 evidence_refs jsonb NOT NULL, receipt_id text NOT NULL, PRIMARY KEY(organization_id,decision_id)
);
