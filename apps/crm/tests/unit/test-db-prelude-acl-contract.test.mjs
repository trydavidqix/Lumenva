import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "vitest";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, "../../scripts/test-db.sh");
const selfhostPreludePath = join(__dirname, "../../scripts/selfhost-prelude.sql");

describe("test-db Supabase table default ACL contract", () => {
  it("enforces default privileges correctly", async () => {
    const script = await readFile(scriptPath, "utf8");
    const selfhostPrelude = await readFile(selfhostPreludePath, "utf8");

    for (const source of [script, selfhostPrelude]) {
      assert.match(source, /alter default privileges[^;]*on tables to anon/i);
      assert.match(source, /alter default privileges[^;]*on tables to authenticated/i);
      assert.match(source, /alter default privileges[^;]*on tables to service_role/i);
    }
  });
});
