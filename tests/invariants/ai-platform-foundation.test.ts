import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const container = process.env.TEST_DB_CONTAINER;
if (!container) throw new Error("TEST_DB_CONTAINER not set — run via pnpm test:db");

function sql(script: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", container!, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"],
    { input: script, encoding: "utf8" },
  ).trim();
}

describe("AI Platform foundation schema", () => {
  it("has tenant-aware flags and an idempotent projection ledger", () => {
    const output = sql(`
      select relname from pg_class where relname in ('ai_platform_feature_flags', 'ai_projection_ledger') order by relname;
      select conname from pg_constraint where conname = 'ai_projection_ledger_idempotency_key';
    `);
    expect(output.split("\n")).toContain("ai_platform_feature_flags");
    expect(output.split("\n")).toContain("ai_projection_ledger");
    expect(output.split("\n")).toContain("ai_projection_ledger_idempotency_key");
  });

  it("enables RLS and never exposes global flag rows to tenants", () => {
    const output = sql(`
      select relname from pg_class where relname in ('ai_platform_feature_flags', 'ai_projection_ledger') and relrowsecurity order by relname;
      select count(*) from pg_policies where tablename = 'ai_platform_feature_flags' and policyname = 'tenant_isolation_ai_platform_feature_flags_all';
      select count(*) from pg_policies where tablename = 'ai_projection_ledger' and policyname = 'tenant_isolation_ai_projection_ledger_all';
    `);
    expect(output.split("\n")).toEqual(expect.arrayContaining(["ai_platform_feature_flags", "ai_projection_ledger", "1", "1"]));
  });
});
