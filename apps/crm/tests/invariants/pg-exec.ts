import { execFileSync } from "node:child_process";

/** Invariants always connect to the isolated native PostgreSQL 17 test cluster. */
const engine = process.env.TEST_DB_ENGINE ?? "native";
const marker = process.env.TEST_DB_CONTAINER; // Legacy marker for existing invariant specs.
const port = process.env.TEST_DB_PORT ?? "54329";

if (engine !== "native" || !marker?.startsWith("native:")) {
  throw new Error("Native test database not initialized — use `pnpm test:db`.");
}

/** Execute SQL through the native PostgreSQL client. Never invokes a container CLI. */
export function execPsql(
  args: readonly string[],
  script: string,
  opts: { stdio?: "pipe" } = {},
): string {
  return execFileSync("psql", ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "-d", "postgres", ...args], {
    input: script,
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "postgres" },
    ...(opts.stdio ? { stdio: ["pipe", "pipe", "pipe"] as const } : {}),
  });
}

/** Run SQL in one psql session, preserving SET ROLE / JWT claims. */
export function sql(script: string): string {
  return execPsql(["-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"], script).trim();
}
