import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const scriptPath = path.resolve(process.cwd(), "apps/crm/scripts/test-db.sh");

const script = await readFile(scriptPath, "utf8");
const guard = script.indexOf("command -v vitest");
const dockerStart = script.indexOf("docker run");

assert.notEqual(guard, -1);
assert.ok(guard < dockerStart);
assert.match(script, /docker rm -fv \"\$CONTAINER\"/);
console.log("PASS test-db vitest guard contract");
