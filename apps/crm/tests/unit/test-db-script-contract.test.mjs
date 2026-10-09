import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "vitest";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, "../../scripts/test-db.sh");

describe("test-db vitest guard contract", () => {
  it("includes vitest check before docker run", async () => {
    const script = await readFile(scriptPath, "utf8");
    const guard = script.indexOf("command -v vitest");
    const dockerStart = script.indexOf("docker run");

    assert.notEqual(guard, -1);
    assert.ok(guard < dockerStart);
    assert.match(script, /docker rm -fv \"\$CONTAINER\"/);
  });
});
