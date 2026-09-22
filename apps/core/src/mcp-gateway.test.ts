import { describe, expect, it, vi } from "vitest";
import { McpGateway, type McpServerPort } from "./mcp-gateway.js";

function server(): McpServerPort {
  return {
    id: "github",
    version: "2026-07-28",
    listTools: vi.fn(async () => [
      { name: "git.search_code", domain: "github", capabilities: ["search_code"], description: "Search" },
      { name: "git.read_file", domain: "github", capabilities: ["read_file"], description: "Read" },
    ]),
    listResources: vi.fn(async () => ["repo://lumenva"]),
    health: vi.fn(async () => ({ ok: true, latencyMs: 4 })),
  };
}

describe("stateless MCP Gateway", () => {
  it("caches tools/list and resources/list with deterministic ordering", async () => {
    const port = server();
    const gateway = new McpGateway([port], { ttlMs: 1_000 });

    const first = await gateway.catalog("github", 10_000);
    const cached = await gateway.catalog("github", 10_500);

    expect(first.tools.map((tool) => tool.name)).toEqual(["git.read_file", "git.search_code"]);
    expect(first.resources).toEqual(["repo://lumenva"]);
    expect(cached.cacheHit).toBe(true);
    expect(port.listTools).toHaveBeenCalledTimes(1);
    expect(port.listResources).toHaveBeenCalledTimes(1);
  });

  it("refreshes expired catalogs and reports unavailable servers", async () => {
    const port = server();
    const gateway = new McpGateway([port], { ttlMs: 100 });

    await gateway.catalog("github", 10_000);
    const refreshed = await gateway.catalog("github", 10_101);
    expect(refreshed.cacheHit).toBe(false);
    expect(port.listTools).toHaveBeenCalledTimes(2);

    await expect(gateway.health("missing")).resolves.toEqual({ ok: false, code: "CAPABILITY_UNAVAILABLE" });
  });
});
