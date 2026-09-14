import { describe, expect, it } from "vitest";
import { PostgresToolLoopLockStore } from "./postgres-tool-loop-lock";

describe("Postgres ToolLoopLock CAS", () => {
  it("serializa duas instâncias concorrentes e isola tenants", async () => {
    const url = process.env.SESSION_DATABASE_URL;
    if (!url) throw new Error("SESSION_DATABASE_URL is required for this integration test");
    const { Pool } = await import("pg");
    const admin = new Pool({ connectionString: url });
    const tenantA = new Pool({ connectionString: url.replace("postgres:test@", "tenant_a_user:test@"), options: "-c app.org_ids=tenant-a" });
    const tenantB = new Pool({ connectionString: url.replace("postgres:test@", "tenant_b_user:test@"), options: "-c app.org_ids=tenant-b" });
    try {
      await admin.query("truncate public.hermes_tool_loop_locks");
      await admin.query("insert into public.hermes_tool_loop_locks (tenant_id,lock_id,session_id,execution_epoch,iteration,max_iterations,active_tool_call_id,expires_at,version) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)", ["tenant-a", "lock-cas", "session", 1, 0, 2, null, new Date(Date.now() + 60000), 0]);
      const dbA = { query: (text: string, values?: unknown[]) => tenantA.query(text, values) };
      const dbB = { query: (text: string, values?: unknown[]) => tenantB.query(text, values) };
      const results = await Promise.allSettled([
        new PostgresToolLoopLockStore(dbA, "tenant-a", "lock-cas").claim("a", 1),
        new PostgresToolLoopLockStore(dbA, "tenant-a", "lock-cas").claim("b", 1),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      const row = await admin.query("select iteration,active_tool_call_id,version from public.hermes_tool_loop_locks where tenant_id=$1 and lock_id=$2", ["tenant-a", "lock-cas"]);
      expect(row.rows[0]).toMatchObject({ iteration: 1, version: 1 });
      expect(["a", "b"]).toContain(row.rows[0].active_tool_call_id);
      await expect(new PostgresToolLoopLockStore(dbB, "tenant-b", "lock-cas").claim("forged", 1)).rejects.toThrow("tool_loop_lock_missing");
      expect((await tenantB.query("select lock_id from public.hermes_tool_loop_locks where lock_id=$1", ["lock-cas"])).rows).toEqual([]);
      expect((await tenantB.query("update public.hermes_tool_loop_locks set active_tool_call_id=$1 where tenant_id=$2 and lock_id=$3 returning lock_id", ["forged", "tenant-a", "lock-cas"])).rows).toEqual([]);
    } finally { await tenantA.end(); await tenantB.end(); await admin.end(); }
  });
});
