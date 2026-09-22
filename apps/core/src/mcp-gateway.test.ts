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

  it("propagates trace context and validates explicit state handles", async () => {
    const port = server();
    const gateway = new McpGateway([port], { ttlMs: 1_000 });
    const handle = gateway.createStateHandle("github", 10_000, 500);
    const traceparent = "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01";

    expect(gateway.validateStateHandle(handle.handle, 10_499)).toBe(true);
    expect(gateway.validateStateHandle(handle.handle, 10_500)).toBe(false);
    await gateway.catalogWithContext("github", { now: 10_000, traceparent, stateHandle: handle.handle });
    expect(port.listTools).toHaveBeenLastCalledWith({ traceparent, stateHandle: handle.handle });
  });

  it("rejects malformed W3C trace context instead of forwarding it", async () => {
    const gateway = new McpGateway([server()], { ttlMs: 1_000 });

    await expect(gateway.catalogWithContext("github", { traceparent: "not-a-traceparent" })).rejects.toThrow("INVALID_TRACEPARENT");
  });
});
