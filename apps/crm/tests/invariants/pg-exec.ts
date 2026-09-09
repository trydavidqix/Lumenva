import { execFileSync } from "node:child_process";

/**
 * Transporte único de SQL cru pra suíte de invariantes (tests/invariants/**).
 *
 * scripts/test-db.sh escolhe o engine (docker ou native — Postgres via
 * Homebrew/initdb quando o Docker CLI não está disponível) e exporta
 * TEST_DB_ENGINE + TEST_DB_CONTAINER + TEST_DB_PORT antes de chamar o vitest.
 * Este módulo é o único ponto que sabe falar com os dois engines — os
 * consumidores (gov-helpers.ts e os testes com sql()/psql() próprios) não
 * precisam saber qual dos dois está rodando.
 */

const engine = process.env.TEST_DB_ENGINE ?? "docker";
const container = process.env.TEST_DB_CONTAINER;
const port = process.env.TEST_DB_PORT ?? "54329";

if (!container) {
  throw new Error(
    "TEST_DB_CONTAINER not set — run this suite via `pnpm test:db` (scripts/test-db.sh)",
  );
}

/** Runs a psql invocation against the ephemeral test Postgres (Docker container
 * or native pg_ctl instance — scripts/test-db.sh picks the engine) and returns
 * stdout. `args` are extra psql flags; `script` is piped via stdin. */
export function execPsql(
  args: readonly string[],
  script: string,
  opts: { stdio?: "pipe" } = {},
): string {
  const [cmd, fullArgs] =
    engine === "native"
      ? ["psql", ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "-d", "postgres", ...args]]
      : ["docker", ["exec", "-i", container!, "psql", "-U", "postgres", "-d", "postgres", ...args]];
  return execFileSync(cmd, fullArgs, {
    input: script,
    encoding: "utf8",
    env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD ?? "postgres" },
    ...(opts.stdio ? { stdio: ["pipe", "pipe", "pipe"] as const } : {}),
  });
}

/** Runs a SQL script in ONE psql session; returns stdout (tuples-only, trimmed). */
export function sql(script: string): string {
  return execPsql(["-v", "ON_ERROR_STOP=1", "-tA", "-f", "-"], script).trim();
}
