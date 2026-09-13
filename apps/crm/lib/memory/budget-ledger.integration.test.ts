import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { debitBudget, ensureBudgetLedger } from "./budget-ledger";

const IMAGE = "postgres:16";
let container = "";
let pool: Pool;

function docker(...args: string[]): string {
  return execFileSync("docker", args, { encoding: "utf8" }).trim();
}

describe("budget_ledger real Postgres atomic debit", () => {
  beforeAll(async () => {
    container = docker("run", "-d", "--rm", "-e", "POSTGRES_PASSWORD=postgres", "-p", "0:5432", IMAGE);
    let port = "";
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        port = docker("port", container, "5432/tcp").split(":").pop() ?? "";
        docker("exec", container, "pg_isready", "-U", "postgres");
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    if (!port) throw new Error("postgres_container_not_ready");
    pool = new Pool({ host: "127.0.0.1", port: Number(port), user: "postgres", password: "postgres", database: "postgres", max: 20 });
    await ensureBudgetLedger(pool);
  }, 30_000);

  afterAll(async () => {
    await pool?.end();
    if (container) docker("rm", "-f", container);
  });

  it("serializa débitos concorrentes e nunca ultrapassa limit", async () => {
    const tenantId = randomUUID();
    const budgetId = "tokens";
    const results = await Promise.all(
      Array.from({ length: 10 }, () => debitBudget(pool, { tenantId, budgetId, amount: 15, limit: 100 })),
    );

    expect(results.filter(Boolean)).toHaveLength(6);
    expect(results.filter((result) => result === null)).toHaveLength(4);
    const row = await pool.query(`SELECT consumed, "limit" FROM budget_ledger WHERE tenant_id = $1 AND budget_id = $2`, [tenantId, budgetId]);
    expect(row.rows).toEqual([{ consumed: "90", limit: "100" }]);
  });
});
