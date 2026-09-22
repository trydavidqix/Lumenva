import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../../scripts/test-db.sh", import.meta.url), "utf8");
const selfhostPrelude = await readFile(
  new URL("../../scripts/selfhost-prelude.sql", import.meta.url),
  "utf8",
);

for (const source of [script, selfhostPrelude]) {
  assert.match(source, /alter default privileges[^;]*on tables to anon/i);
  assert.match(source, /alter default privileges[^;]*on tables to authenticated/i);
  assert.match(source, /alter default privileges[^;]*on tables to service_role/i);
}

console.log("PASS test-db Supabase table default ACL contract");
