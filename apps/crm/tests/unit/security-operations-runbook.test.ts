import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("security operations runbook", () => {
  it("keeps reproducible gates, redaction rules, and reversible release guidance", () => {
    const runbook = readFileSync("docs/runbooks/security-operations.md", "utf8");
    expect(runbook).toContain("pnpm install --frozen-lockfile");
    expect(runbook).toContain("pnpm --filter lumenva-crm test:db");
    expect(runbook).toContain("lib/sentry/scrub.ts");
    expect(runbook).toContain("Não apagar volumes");
  });
});
