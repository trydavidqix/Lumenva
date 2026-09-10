import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

describe("LGPD export package download contract", () => {
  it("authorizes administrators and scopes requests to the active tenant", () => {
    const source = read("apps/crm/app/api/v1/lgpd/requests/[id]/export/route.ts");
    expect(source).toMatch(/requireRole\("admin"/);
    expect(source).toMatch(/\.eq\("organization_id", authz\.org\.orgId\)/);
  });

  it("returns a private ZIP download with cache and request headers", () => {
    const source = read("apps/crm/app/api/v1/lgpd/requests/[id]/export/route.ts");
    expect(source).toMatch(/"content-type": "application\/zip"/);
    expect(source).toMatch(/"content-disposition": `attachment;/);
    expect(source).toMatch(/"cache-control": "private, no-store/);
    expect(source).toMatch(/"x-request-id": requestId/);
    expect(source).toMatch(/"content-length": String\(zip\.byteLength\)/);
  });
});
