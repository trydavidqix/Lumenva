import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("apps/crm/app/api/v1/contacts/_handler.ts", "utf8");

describe("consent mutation audit contract", () => {
  it("emits the canonical consent audit action", () => {
    expect(source).toContain('action: "lgpd.consent_changed"');
    expect(source).toContain('p_event_type: "lgpd.consent_changed"');
  });

  it("does not put consent values in the audit payload", () => {
    expect(source).not.toMatch(/p_payload:\s*\{[^}]*consent:\s*input\.consent/s);
  });
});
