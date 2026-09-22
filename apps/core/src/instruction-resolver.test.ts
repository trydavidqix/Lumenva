import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveInstructions } from "./instruction-resolver.js";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "lumenva-instructions-"));
  mkdirSync(join(root, "apps", "core", "src"), { recursive: true });
  writeFileSync(join(root, "AGENTS.md"), "root doctrine\n");
  writeFileSync(join(root, "CLAUDE.md"), "claude adapter\n");
  writeFileSync(join(root, "GEMINI.md"), "gemini adapter\n");
  writeFileSync(join(root, "apps", "AGENTS.md"), "apps scope\n");
  writeFileSync(join(root, "apps", "core", "AGENTS.md"), "core scope\n");
  return root;
}

describe("Instruction Resolver", () => {
  it("merges doctrine hierarchically and adapts only the selected runtime", () => {
    const root = fixture();
    const codex = resolveInstructions({ rootDir: root, targetPath: "apps/core/src/runtime.ts", runtime: "codex", doctrine: "universal doctrine\n" });
    const claude = resolveInstructions({ rootDir: root, targetPath: "apps/core/src/runtime.ts", runtime: "claude", doctrine: "universal doctrine\n" });

    expect(codex.sources.map((source) => source.name)).toEqual(["Lumenva Doctrine", "AGENTS.md", "AGENTS.md", "AGENTS.md"]);
    expect(codex.combined).toContain("root doctrine");
    expect(codex.combined).not.toContain("claude adapter");
    expect(claude.combined).toContain("claude adapter");
    expect(claude.combined).not.toContain("gemini adapter");
    expect(codex.contextVersion).toMatch(/^[a-f0-9]{64}$/);
  });

  it("applies a deterministic hard cap without changing source order", () => {
    const root = fixture();
    const packet = resolveInstructions({ rootDir: root, targetPath: "apps/core/src/runtime.ts", runtime: "gemini", doctrine: "D".repeat(100), budgetChars: 260 });

    expect(packet.characterCount).toBeLessThanOrEqual(260);
    expect(packet.sources[0]?.name).toBe("Lumenva Doctrine");
    expect(packet.combined).toContain("D");
    expect(packet.combined).toContain("root doctrine");
  });
});
