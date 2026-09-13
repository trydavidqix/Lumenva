import { describe, expect, it } from "vitest";
import { PostgresToolLoopLockStore } from "./postgres-tool-loop-lock";

describe("Postgres ToolLoopLock CAS", () => {
  it("serializa duas instâncias concorrentes", async () => {
    const url = process.env.SESSION_DATABASE_URL;
    if (!url) return;
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    await pool.query(`CREATE TABLE IF NOT EXISTS hermes_tool_loop_locks (lock_id text PRIMARY KEY, session_id text NOT NULL, execution_epoch integer NOT NULL, iteration integer NOT NULL, max_iterations integer NOT NULL, active_tool_call_id text, expires_at timestamptz NOT NULL, version integer NOT NULL DEFAULT 0)`);
    await pool.query("DELETE FROM hermes_tool_loop_locks WHERE lock_id = $1", ["lock-cas"]);
    await pool.query("INSERT INTO hermes_tool_loop_locks VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", ["lock-cas", "session", 1, 0, 2, null, new Date(Date.now() + 60000), 0]);
    const db = { query: (text: string, values?: unknown[]) => pool.query(text, values) };
    const results = await Promise.allSettled([new PostgresToolLoopLockStore(db, "lock-cas").claim("a", 1), new PostgresToolLoopLockStore(db, "lock-cas").claim("b", 1)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const row = await pool.query("SELECT iteration, active_tool_call_id, version FROM hermes_tool_loop_locks WHERE lock_id = $1", ["lock-cas"]);
    expect(row.rows[0]).toMatchObject({ iteration: 1, version: 1 });
    await pool.end();
  });
});
