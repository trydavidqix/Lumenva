import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AI Platform Golden Dataset", () => {
  it("contains at least 25 synthetic cases with unique identifiers", () => {
    const cases: Array<{ id: string; organization_id: string; contact_id: string; expected: { risk: string } }> = JSON.parse(
      readFileSync("tests/fixtures/ai-platform/golden-cases.json", "utf8"),
    );
    // Not a fixed snapshot count: the fixture's own schema (scripts/ai-platform-eval.ts)
    // enforces .min(25), and this file has already grown once (25 -> 30) as later
    // phases added cases. Pinning an exact literal here would make every legitimate
    // addition a false regression instead of testing the real invariants (minimum
    // size + id uniqueness + well-formed rows).
    expect(cases.length).toBeGreaterThanOrEqual(25);
    expect(new Set(cases.map((item) => item.id)).size).toBe(cases.length);
    expect(cases.every((item) => item.organization_id.startsWith("00000000-") && item.contact_id.startsWith("00000000-") && ["low", "medium", "high"].includes(item.expected.risk))).toBe(true);
  });
});
