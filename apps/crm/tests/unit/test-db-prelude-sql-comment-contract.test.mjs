import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../../scripts/test-db.sh", import.meta.url), "utf8");
const sqlPrelude = script.match(/psql_install <<'SQL'\r?\n([\s\S]*?)\r?\nSQL/);

assert.ok(sqlPrelude, "test-db.sh must contain SQL heredoc");
assert.match(sqlPrelude[1], /-- Match Supabase's default table ACL/);
assert.doesNotMatch(sqlPrelude[1], /^#/m);

console.log("PASS SQL heredoc comment syntax contract");
