import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const consumers = [
  ["media persist worker", "apps/crm/workers/media-persist-worker.ts"],
  ["media derive worker", "apps/crm/workers/media-derive-worker.ts"],
  ["LGPD export worker", "apps/crm/workers/lgpd-export-worker.ts"],
  ["privacy download route", "apps/crm/app/api/v1/privacy/requests/[id]/route.ts"],
] as const;

describe("F5 GCS storage boundary", () => {
  it.each(consumers)("%s uses the shared GCS object store", (_name, path) => {
    const source = read(path);
    expect(source).toMatch(/createGcsObjectStore/);
    expect(source).toMatch(/getGcsBucket/);
    expect(source).not.toMatch(/admin\.storage\.from\(/);
  });
});
