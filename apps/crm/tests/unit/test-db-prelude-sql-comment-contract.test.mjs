import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, "../../scripts/test-db.sh");
const script = await readFile(scriptPath, "utf8");
const sqlPrelude = script.match(/psql_install <<'SQL'\r?\n([\s\S]*?)\r?\nSQL/);

assert.ok(sqlPrelude, "test-db.sh must contain SQL heredoc");
assert.match(sqlPrelude[1], /-- Match Supabase's default table ACL/);
assert.doesNotMatch(sqlPrelude[1], /^#/m);

console.log("PASS SQL heredoc comment syntax contract");
