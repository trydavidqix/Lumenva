import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "vitest";

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const baselinePath = join(__dirname, "../../../../infra/supabase/baseline.sql");

describe("baseline unique-index idempotency contract", () => {
  it("uses IF NOT EXISTS on all unique indexes", async () => {
    const baseline = await readFile(baselinePath, "utf8");

    const missingGuard = [];
    for (const match of baseline.matchAll(
      /create\s+unique\s+index\s+(?!if\s+not\s+exists\s+)(?:"([^"]+)"|([a-z0-9_]+))/gi,
    )) {
      missingGuard.push(match[1] ?? match[2]);
    }

    assert.deepEqual(missingGuard, [], `Unique indexes without IF NOT EXISTS: ${missingGuard.join(", ")}`);
  });
});
