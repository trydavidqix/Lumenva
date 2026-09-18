import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("release handoff contract", () => {
  it("records the base SHA, isolated-chain policy, gates, and owner decisions", () => {
    const handoff = readFileSync("docs/release/lumenva-release-handoff-2026-09-15.md", "utf8");
    expect(handoff).toContain("fec2d25348d357e9091c2d5e11fbfd7ee7427208");
    expect(handoff).toContain("Nenhuma branch foi\nmergeada");
    expect(handoff).toContain("pnpm --filter lumenva-crm test:db");
    expect(handoff).toContain("Pendências que exigem o dono");
  });
});
