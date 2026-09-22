import { createHash } from "node:crypto";
import type { ToolDefinition } from "./tool-registry.js";

export type McpServerPort = {
  id: string;
  version: string;
  listTools(context?: McpRequestContext): Promise<ToolDefinition[]>;
  listResources(context?: McpRequestContext): Promise<string[]>;
  health(): Promise<{ ok: boolean; latencyMs: number }>;
};

export type McpRequestContext = {
  traceparent: string;
  stateHandle?: string;
};

export function isValidTraceparent(value: string): boolean {
  const match = /^(?<version>[\da-f]{2})-(?<trace>[\da-f]{32})-(?<span>[\da-f]{16})-(?<flags>[\da-f]{2})$/i.exec(value);
  if (!match?.groups) return false;
  if (match.groups.version.toLowerCase() === "ff") return false;
  if (/^0+$/.test(match.groups.trace) || /^0+$/.test(match.groups.span)) return false;
  return true;
}

export type McpCatalog = {
  serverId: string;
  version: string;
  tools: ToolDefinition[];
  resources: string[];
  fetchedAt: number;
  cacheHit: boolean;
  traceparent?: string;
  stateHandle?: string;
  catalogVersion: string;
};

type CachedCatalog = Omit<McpCatalog, "cacheHit" | "catalogVersion">;

export class McpGateway {
  private readonly servers = new Map<string, McpServerPort>();
  private readonly cache = new Map<string, CachedCatalog>();
  private readonly handles = new Map<string, { serverId: string; expiresAt: number }>();

  constructor(ports: McpServerPort[], private readonly options: { ttlMs: number }) {
    for (const port of ports) this.servers.set(port.id, port);
  }

  async catalog(serverId: string, now = Date.now()): Promise<McpCatalog> {
    return this.loadCatalog(serverId, now);
  }

  async catalogWithContext(serverId: string, context: McpRequestContext & { now?: number }): Promise<McpCatalog> {
    if (!isValidTraceparent(context.traceparent)) throw new Error("INVALID_TRACEPARENT");
    const { now, ...requestContext } = context;
    return this.loadCatalog(serverId, now ?? Date.now(), requestContext);
  }

  createStateHandle(serverId: string, createdAt = Date.now(), ttlMs = this.options.ttlMs): { handle: string; serverId: string; expiresAt: number } {
    if (!this.servers.has(serverId)) throw new Error(`CAPABILITY_UNAVAILABLE: ${serverId}`);
    const expiresAt = createdAt + Math.max(0, ttlMs);
    const handle = `handle-${createHash("sha256").update(`${serverId}:${createdAt}:${expiresAt}`).digest("hex").slice(0, 32)}`;
    this.handles.set(handle, { serverId, expiresAt });
    return { handle, serverId, expiresAt };
  }

  validateStateHandle(handle: string, now = Date.now()): boolean {
    const state = this.handles.get(handle);
    return Boolean(state && now < state.expiresAt && this.servers.has(state.serverId));
  }

  private async loadCatalog(serverId: string, now: number, context?: McpRequestContext): Promise<McpCatalog> {
    const server = this.servers.get(serverId);
    if (!server) throw new Error(`CAPABILITY_UNAVAILABLE: ${serverId}`);
    const cached = this.cache.get(serverId);
    if (cached && now - cached.fetchedAt < this.options.ttlMs) return this.withVersion(cached, true, context);

    const [tools, resources] = await Promise.all([server.listTools(context), server.listResources(context)]);
    const fresh: CachedCatalog = {
      serverId,
      version: server.version,
      tools: [...tools].sort((left, right) => left.name.localeCompare(right.name)),
      resources: [...resources].sort(),
      fetchedAt: now,
    };
    this.cache.set(serverId, fresh);
    return this.withVersion(fresh, false, context);
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

  private withVersion(cached: CachedCatalog, cacheHit: boolean, context?: McpRequestContext): McpCatalog {
    return {
      ...cached,
      cacheHit,
      traceparent: context?.traceparent,
      stateHandle: context?.stateHandle,
      catalogVersion: createHash("sha256").update(JSON.stringify({ version: cached.version, tools: cached.tools, resources: cached.resources })).digest("hex"),
    };
  }
}
