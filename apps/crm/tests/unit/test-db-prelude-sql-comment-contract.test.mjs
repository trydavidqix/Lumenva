import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "vitest";

test("test-db SQL prelude uses SQL comments", async () => {
  const script = await readFile(path.resolve(process.cwd(), "apps/crm/scripts/test-db.sh"), "utf8");
  const sqlPrelude = script.match(/psql_install <<'SQL'\r?\n([\s\S]*?)\r?\nSQL/);

  assert.ok(sqlPrelude, "test-db.sh must contain SQL heredoc");
  assert.match(sqlPrelude[1], /-- Match Supabase's default table ACL/);
  assert.doesNotMatch(sqlPrelude[1], /^#/m);
});
