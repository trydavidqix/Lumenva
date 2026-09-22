import { createHash } from "node:crypto";
import type { ToolDefinition } from "./tool-registry.js";

export type McpServerPort = {
  id: string;
  version: string;
  listTools(): Promise<ToolDefinition[]>;
  listResources(): Promise<string[]>;
  health(): Promise<{ ok: boolean; latencyMs: number }>;
};

export type McpCatalog = {
  serverId: string;
  version: string;
  tools: ToolDefinition[];
  resources: string[];
  fetchedAt: number;
  cacheHit: boolean;
  catalogVersion: string;
};

type CachedCatalog = Omit<McpCatalog, "cacheHit" | "catalogVersion">;

export class McpGateway {
  private readonly servers = new Map<string, McpServerPort>();
  private readonly cache = new Map<string, CachedCatalog>();

  constructor(ports: McpServerPort[], private readonly options: { ttlMs: number }) {
    for (const port of ports) this.servers.set(port.id, port);
  }

  async catalog(serverId: string, now = Date.now()): Promise<McpCatalog> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`CAPABILITY_UNAVAILABLE: ${serverId}`);
    const cached = this.cache.get(serverId);
    if (cached && now - cached.fetchedAt < this.options.ttlMs) return this.withVersion(cached, true);

    const [tools, resources] = await Promise.all([server.listTools(), server.listResources()]);
    const fresh: CachedCatalog = {
      serverId,
      version: server.version,
      tools: [...tools].sort((left, right) => left.name.localeCompare(right.name)),
      resources: [...resources].sort(),
      fetchedAt: now,
    };
    this.cache.set(serverId, fresh);
    return this.withVersion(fresh, false);
  }

  async health(serverId: string): Promise<{ ok: boolean; latencyMs?: number; code?: "CAPABILITY_UNAVAILABLE" | "MCP_UNAVAILABLE" }> {
    const server = this.servers.get(serverId);
    if (!server) return { ok: false, code: "CAPABILITY_UNAVAILABLE" };
    try {
      return await server.health();
    } catch {
      return { ok: false, code: "MCP_UNAVAILABLE" };
    }
  }

  private withVersion(cached: CachedCatalog, cacheHit: boolean): McpCatalog {
    return {
      ...cached,
      cacheHit,
      catalogVersion: createHash("sha256").update(JSON.stringify({ version: cached.version, tools: cached.tools, resources: cached.resources })).digest("hex"),
    };
  }
}
