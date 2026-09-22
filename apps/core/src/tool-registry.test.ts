import { describe, expect, it } from "vitest";
import { ToolRegistry, type ToolDefinition } from "./tool-registry.js";

const tools: ToolDefinition[] = [
  { name: "browser.open", domain: "browser", capabilities: ["browser"], description: "Open a page" },
  { name: "git.commit", domain: "github", capabilities: ["commit"], description: "Create a commit" },
  { name: "git.diff", domain: "github", capabilities: ["git_diff"], description: "Read a diff" },
  { name: "git.search_code", domain: "github", capabilities: ["search_code"], description: "Search code" },
  { name: "git.read_file", domain: "github", capabilities: ["read_file"], description: "Read a file" },
  { name: "instagram.publish", domain: "social", capabilities: ["publish"], description: "Publish content" },
];

describe("lazy Tool Registry", () => {
  it("exposes only tools matching task capabilities and domain", () => {
    const catalog = new ToolRegistry(tools).resolve({ capabilities: ["read_file", "search_code"], domains: ["github"] });

    expect(catalog.tools.map((tool) => tool.name)).toEqual(["git.read_file", "git.search_code"]);
    expect(catalog.tools.some((tool) => tool.name === "instagram.publish")).toBe(false);
    expect(catalog.exposedCount).toBe(2);
  });

  it("applies a deterministic definition cap and never returns the global catalog", () => {
    const registry = new ToolRegistry(tools);
    const first = registry.resolve({ capabilities: ["commit", "git_diff", "search_code", "read_file"], maxDefinitions: 2 });
    const second = new ToolRegistry([...tools].reverse()).resolve({ capabilities: ["commit", "git_diff", "search_code", "read_file"], maxDefinitions: 2 });

    expect(first.tools.map((tool) => tool.name)).toEqual(["git.commit", "git.diff"]);
    expect(first).toEqual(second);
    expect(first.tools.length).toBeLessThan(tools.length);
  });
});
