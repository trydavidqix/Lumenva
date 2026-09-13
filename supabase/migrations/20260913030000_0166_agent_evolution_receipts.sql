CREATE TABLE IF NOT EXISTS agent_evolution_receipts (
 organization_id text NOT NULL, actor_id text NOT NULL, action_id text NOT NULL,
 idempotency_key text NOT NULL, status text NOT NULL CHECK (status='PERSISTED'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (organization_id, actor_id, action_id, idempotency_key)
);
