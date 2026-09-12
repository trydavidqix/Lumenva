import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const runner = await readFile(join(here, "migrate-db.mjs"), "utf8");

test("db:migrate aplica baseline canónico antes do glob de migrations", () => {
  assert.match(runner, /baseline.sql/);
  assert.match(runner, /00000_baseline/);
  assert.ok(runner.indexOf("baseline.sql") < runner.indexOf("readdir(dir)"));
});
