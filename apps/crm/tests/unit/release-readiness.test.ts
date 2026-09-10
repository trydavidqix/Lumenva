import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("release readiness contract", () => {
  it("keeps readiness lightweight and cache-free", () => {
    const source = readFileSync("apps/crm/app/api/v1/readyz/route.ts", "utf8");
    expect(source).toMatch(/status: \"ready\"/);
    expect(source).toMatch(/cache-control.*no-store/);
  });
});
