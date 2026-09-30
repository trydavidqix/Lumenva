import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "vitest";

test("database invariants use native PostgreSQL 17, never a container", async () => {
  const script = await readFile(path.resolve(process.cwd(), "apps/crm/scripts/test-db.sh"), "utf8");
  const transport = await readFile(path.resolve(process.cwd(), "apps/crm/tests/invariants/pg-exec.ts"), "utf8");
  const preflight = script.indexOf("command -v vitest");
  const init = script.indexOf('"$PG_BIN/initdb"');
  assert.ok(preflight >= 0 && init >= 0 && preflight < init);
  assert.match(script, /TEST_DB_ENGINE:-native/);
  assert.match(script, /PG_MAJOR.*= 17/);
  assert.match(script, /vector\.control/);
  assert.match(script, /trap cleanup EXIT/);
  assert.doesNotMatch(script, /\bdocker\s+(?:run|exec|rm|info)\b/i);
  assert.doesNotMatch(transport, /execFileSync\(["']docker["']/);
});
