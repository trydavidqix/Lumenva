import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "vitest";

test("test-db setup grants the expected default table ACLs", async () => {
  const script = await readFile(path.resolve(process.cwd(), "apps/crm/scripts/test-db.sh"), "utf8");
  const selfhostPrelude = await readFile(
    path.resolve(process.cwd(), "apps/crm/scripts/selfhost-prelude.sql"),
    "utf8",
  );

  for (const source of [script, selfhostPrelude]) {
    assert.match(source, /alter default privileges[^;]*on tables to anon/i);
    assert.match(source, /alter default privileges[^;]*on tables to authenticated/i);
    assert.match(source, /alter default privileges[^;]*on tables to service_role/i);
  }
});
