CREATE TABLE IF NOT EXISTS hermes_session_supersession (
  organization_id text PRIMARY KEY,
  active_session_id text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 0
);
