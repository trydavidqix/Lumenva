import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AI Platform Golden Dataset", () => {
  it("contains 25 synthetic cases with unique identifiers", () => {
    const cases: Array<{ id: string; organization_id: string; contact_id: string; expected: { risk: string } }> = JSON.parse(
      readFileSync("tests/fixtures/ai-platform/golden-cases.json", "utf8"),
    );
    expect(cases).toHaveLength(25);
    expect(new Set(cases.map((item) => item.id)).size).toBe(25);
    expect(cases.every((item) => item.organization_id.startsWith("00000000-") && item.contact_id.startsWith("00000000-") && ["low", "medium", "high"].includes(item.expected.risk))).toBe(true);
  });
});
