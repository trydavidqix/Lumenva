import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scriptPath = new URL("../../scripts/test-db.sh", import.meta.url);

const script = await readFile(scriptPath, "utf8");
const guard = script.indexOf("command -v vitest");
const dockerStart = script.indexOf("docker run");

assert.notEqual(guard, -1);
assert.ok(guard < dockerStart);
console.log("PASS test-db vitest guard contract");
