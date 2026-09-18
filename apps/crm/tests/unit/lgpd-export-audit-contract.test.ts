import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("apps/crm/app/api/v1/lgpd/requests/[id]/export/route.ts", "utf8");

describe("LGPD export audit contract", () => {
  it("audits direct export generation", () => {
    expect(source).toContain('action: "lgpd.export_generated"');
    expect(source).toContain("signed_pades: false");
  });

  it("does not audit the exported payload", () => {
    expect(source).not.toMatch(/metadata:\s*\{[^}]*payload/s);
  });
});
