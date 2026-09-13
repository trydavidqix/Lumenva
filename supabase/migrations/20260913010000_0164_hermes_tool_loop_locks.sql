CREATE TABLE IF NOT EXISTS hermes_tool_loop_locks (
  lock_id text PRIMARY KEY, session_id text NOT NULL, execution_epoch integer NOT NULL,
  iteration integer NOT NULL DEFAULT 0, max_iterations integer NOT NULL,
  active_tool_call_id text, expires_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 0
);
