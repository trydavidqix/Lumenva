import type { GraphEpisode, GraphFact, KnowledgeGraph } from "./graph.js";

type GraphitiResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

type GraphitiFetch = (url: string, init: {
  method: "DELETE" | "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  signal: AbortSignal;
}) => Promise<GraphitiResponse>;

export type GraphitiHttpConfig = {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: GraphitiFetch;
};

export class GraphitiHttpError extends Error {
  constructor(readonly kind: "configuration" | "http" | "invalid_response" | "request" | "timeout", message: string) {
    super(message);
    this.name = "GraphitiHttpError";
  }
}

export class GraphitiHttpClient implements KnowledgeGraph {
  private readonly baseUrl: string;
  private readonly fetchImpl: GraphitiFetch;

  constructor(private readonly config: GraphitiHttpConfig) {
    if (!config.apiKey || !Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0) {
      throw new GraphitiHttpError("configuration", "Graphiti configuration is invalid");
    }
    try {
      this.baseUrl = new URL(config.baseUrl).toString().replace(/\/$/, "");
    } catch {
      throw new GraphitiHttpError("configuration", "Graphiti configuration is invalid");
    }
    this.fetchImpl = config.fetchImpl ?? (fetch as unknown as GraphitiFetch);
  }

  async addEpisode(episode: GraphEpisode): Promise<void> {
    const response = await this.request("/messages", "POST", {
      group_id: episode.namespace,
      messages: [{
        uuid: episode.idempotencyKey,
        content: episode.body,
        name: episode.title,
        role_type: "system",
        role: null,
        timestamp: episode.referenceTime,
        source_description: episode.provenance.sourcePath,
      }],
    });
    const body = await response.json();
    if (!isSuccessResponse(body)) throw new GraphitiHttpError("http", "Graphiti rejected episode ingestion");
  }

  async search(input: { namespace: string; query: string; limit: number }): Promise<GraphFact[]> {
    if (!input.namespace || !input.query || !Number.isInteger(input.limit) || input.limit < 1) {
      throw new GraphitiHttpError("configuration", "Graphiti search input is invalid");
    }
    const response = await this.request("/search", "POST", {
      group_ids: [input.namespace],
      query: input.query,
      max_facts: input.limit,
    });
    const body = await response.json();
    if (!isRecord(body) || !Array.isArray(body.facts)) {
      throw new GraphitiHttpError("invalid_response", "Graphiti returned an unexpected search response");
    }
    return body.facts.flatMap((fact): GraphFact[] => {
      if (!isRecord(fact) || typeof fact.uuid !== "string" || typeof fact.fact !== "string") return [];
      return [{
        id: fact.uuid,
        text: fact.fact,
        sourceId: fact.uuid,
        confidence: 0,
        validFrom: normalizeDate(fact.valid_at),
        validUntil: normalizeDate(fact.invalid_at),
      }];
    });
  }

  async health(): Promise<{ ok: boolean; latencyMs: number }> {
    const startedAt = Date.now();
    await this.request("/healthcheck", "GET");
    return { ok: true, latencyMs: Date.now() - startedAt };
  }

  private async request(path: string, method: "DELETE" | "GET" | "POST", body?: unknown): Promise<GraphitiResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json", "X-Api-Key": this.config.apiKey },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw new GraphitiHttpError("http", `Graphiti request failed with status ${response.status}`);
      return response;
    } catch (error) {
      if (error instanceof GraphitiHttpError) throw error;
      if (controller.signal.aborted) throw new GraphitiHttpError("timeout", "Graphiti request timed out");
      throw new GraphitiHttpError("request", "Graphiti request failed");
    } finally {
      clearTimeout(timeout);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuccessResponse(value: unknown): boolean {
  return isRecord(value) && value.success === true;
}

function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new GraphitiHttpError("invalid_response", "Graphiti returned an invalid timestamp");
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new GraphitiHttpError("invalid_response", "Graphiti returned an invalid timestamp");
  return date.toISOString();
}
