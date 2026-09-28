import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "vitest";

test("baseline unique indexes are idempotent", async () => {
  const baseline = await readFile(
    path.resolve(process.cwd(), "infra/supabase/baseline.sql"),
    "utf8",
  );

  const missingGuard = [];
  for (const match of baseline.matchAll(
    /create\s+unique\s+index\s+(?!if\s+not\s+exists\s+)(?:"([^"]+)"|([a-z0-9_]+))/gi,
  )) {
    missingGuard.push(match[1] ?? match[2]);
  }

  assert.deepEqual(missingGuard, [], `Unique indexes without IF NOT EXISTS: ${missingGuard.join(", ")}`);
});
