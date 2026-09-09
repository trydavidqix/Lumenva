import { z } from "zod";

import { sanitizeGraphEpisode } from "./episode-sanitize";
import { graphGroupId } from "./namespace";
import type { GraphContextPort } from "./port";
import {
  graphEpisodeSchema,
  graphFactSchema,
  graphSearchInputSchema,
  organizationIdSchema,
  type GraphEpisode,
  type GraphFact,
  type GraphSearchInput,
} from "./types";

export interface GraphitiClientConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

type GraphitiProviderErrorKind =
  | "configuration"
  | "http"
  | "invalid_response"
  | "request"
  | "sanitization"
  | "timeout";

export class GraphitiProviderError extends Error {
  constructor(readonly kind: GraphitiProviderErrorKind, message: string) {
    super(message);
    this.name = "GraphitiProviderError";
  }
}

/**
 * Wire contract for `zepai/graphiti:0.22.0` (`graph_service`), confirmed by
 * starting the pinned image locally and reading its packaged source
 * (`graph_service/dto/*.py`, `graph_service/routers/*.py`) directly — the
 * image never reaches a running/authenticated state in this environment
 * (see docker-compose.yml for why), so there is no live OpenAPI JSON to fetch;
 * the source is ground truth instead. Real routes: `POST /messages` (202,
 * queued — not proof of a completed graph write), `POST /search`,
 * `DELETE /group/{group_id}`, `GET /healthcheck`. There is no
 * `POST /episodes` / generic text-or-json ingest route and no server-side
 * auth check of any kind in this image version.
 */
const resultSchema = z.object({ message: z.string().min(1), success: z.boolean() });

const factResultSchema = z.object({
  uuid: z.string().min(1),
  name: z.string(),
  fact: z.string().min(1),
  valid_at: z.string().nullable(),
  invalid_at: z.string().nullable(),
  created_at: z.string(),
  expired_at: z.string().nullable(),
});

const searchResponseSchema = z.object({ facts: z.array(factResultSchema) });

/**
 * Normalizes a Graphiti timestamp into the offset-qualified ISO-8601 string
 * `GraphFact` requires. The packaged DTO types these fields as Python
 * `datetime`; FastAPI's default encoder emits an offset for timezone-aware
 * values, but this adapter does not assume that holds for every deployment —
 * an unparseable value is treated as an invalid response, never guessed at.
 */
function toOffsetDateTime(value: string | null): string | null {
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new GraphitiProviderError("invalid_response", "Graphiti returned a non-parseable timestamp");
  }
  return parsed.toISOString();
}

/**
 * Maps one wire `FactResult` to the port's `GraphFact`. Graphiti's packaged
 * REST server does not return per-fact source/episode provenance, nor a
 * confidence/authorityDomain/risk envelope — those are this codebase's
 * concepts, not Graphiti's. Rather than invent a plausible-looking value,
 * every mapped fact is pinned to the most conservative point this closed
 * vocabulary allows, so no fact from this adapter can read as high-authority
 * data on its own:
 * - `sourceId` falls back to the fact's own id (Graphiti has no separate
 *   provenance id to offer);
 * - `confidence: 0` — the provider asserts no confidence signal;
 * - `risk: "high"` — forces caller-side caution, never an implicit "safe";
 * - `authorityDomain: "behavior"` — the vocabulary's most neutral/
 *   observational domain, never consent/legal/commercial_status.
 */
function toGraphFact(raw: z.infer<typeof factResultSchema>): GraphFact {
  const candidate = {
    id: raw.uuid,
    text: raw.fact,
    sourceId: raw.uuid,
    validFrom: toOffsetDateTime(raw.valid_at),
    validUntil: toOffsetDateTime(raw.invalid_at),
    confidence: 0,
    authorityDomain: "behavior" as const,
    risk: "high" as const,
  };

  const parsed = graphFactSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new GraphitiProviderError("invalid_response", "Graphiti returned a fact outside the expected contract");
  }
  return parsed.data;
}

export class GraphitiClient implements GraphContextPort {
  private readonly baseUrl: string;

  constructor(private readonly config: GraphitiClientConfig) {
    if (!config.baseUrl || !config.apiKey || !Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0) {
      throw new GraphitiProviderError("configuration", "Graphiti configuration is invalid");
    }

    try {
      this.baseUrl = new URL(config.baseUrl).toString().replace(/\/$/, "");
    } catch {
      throw new GraphitiProviderError("configuration", "Graphiti configuration is invalid");
    }
  }

  /**
   * Derives the trusted FalkorDB/Graphiti group id from `organizationId`.
   * `organizationIdSchema`/`graphEpisodeSchema`/`graphSearchInputSchema`
   * only require a non-empty string (Task 1's contract), which is weaker
   * than `graphGroupId()`'s strict UUID check — an organizationId that
   * passes those schemas can still fail here. That failure is normalized
   * into this adapter's own typed error instead of leaking a bare ZodError
   * from `namespace.ts` across the port boundary.
   */
  private trustedGroupId(organizationId: string): string {
    try {
      return graphGroupId(organizationId);
    } catch {
      throw new GraphitiProviderError(
        "configuration",
        "organizationId is not a valid UUID for the graph namespace",
      );
    }
  }

  /**
   * `sanitizeGraphEpisode` (Task 5) is the outbound secret-blocking gate this
   * port's own doctrine comment requires ("adapters ingest curated/sanitized
   * event text, never secrets/raw credentials"). It is invoked here, inside
   * the adapter, rather than left to be called by whichever future caller
   * happens to project events into Graphiti — a check that lives only at a
   * call site can be silently skipped by the next caller that forgets it; a
   * check inside the one method that actually reaches the network cannot be.
   * Fails closed like its Mem0 (Phase 2/3) counterpart: a blocked episode is
   * never partially redacted and sent, it is rejected outright before any
   * request is built.
   */
  async addEpisode(episode: GraphEpisode, idempotencyKey: string): Promise<void> {
    const parsedEpisode = graphEpisodeSchema.parse(episode);
    z.string().min(1).parse(idempotencyKey);

    const sanitized = sanitizeGraphEpisode(parsedEpisode);
    if (!sanitized.allowed) {
      throw new GraphitiProviderError(
        "sanitization",
        `Graphiti episode blocked before egress: ${sanitized.reason}`,
      );
    }

    const groupId = this.trustedGroupId(parsedEpisode.organizationId);

    const response = await this.request("/messages", "POST", {
      group_id: groupId,
      messages: [
        {
          // The wire uuid is the caller-supplied idempotency key, not a
          // random id: Graphiti's EpisodicNode.save() is a Cypher `MERGE`
          // keyed on this uuid (confirmed in graphiti_core's
          // EPISODIC_NODE_SAVE query), so re-sending the same idempotency
          // key upserts the same node instead of duplicating it.
          uuid: idempotencyKey,
          content: parsedEpisode.body,
          name: parsedEpisode.name,
          // This image's /messages route hardcodes
          // `source=EpisodeType.message` server-side no matter what is
          // sent here (confirmed in graph_service/routers/ingest.py) — a
          // generic text/json episode route does not exist on this pinned
          // version. `sourceType` therefore cannot be represented distinctly
          // over this wire contract; role_type/role only affect the raw
          // text Graphiti stores for extraction, not episode typing, so a
          // fixed neutral role_type is used rather than overloading it.
          role_type: "system" as const,
          role: null,
          timestamp: parsedEpisode.referenceTime,
          source_description: parsedEpisode.sourceDescription,
        },
      ],
    });

    const parsed = this.parseResponse(resultSchema, response);
    if (!parsed.success) {
      throw new GraphitiProviderError("http", "Graphiti reported an episode ingestion failure");
    }
  }

  async search(input: GraphSearchInput): Promise<GraphFact[]> {
    const parsedInput = graphSearchInputSchema.parse(input);
    const groupId = this.trustedGroupId(parsedInput.organizationId);

    const response = await this.request("/search", "POST", {
      // Graphiti's wire contract accepts `group_ids` as a list (multi-group
      // search). This method's public signature only ever accepts a single
      // `organizationId`, and the only value placed in the list is the
      // group id this adapter derives from it — there is no parameter here
      // through which a caller can add a second group id or supply a raw
      // group id directly, so no cross-group search can be constructed
      // through this surface.
      group_ids: [groupId],
      query: parsedInput.query,
      max_facts: parsedInput.limit,
    });

    const parsed = this.parseResponse(searchResponseSchema, response);
    return parsed.facts.map((fact) => toGraphFact(fact));
  }

  async deleteOrganization(organizationId: string): Promise<void> {
    const parsedOrganizationId = organizationIdSchema.parse(organizationId);
    const groupId = this.trustedGroupId(parsedOrganizationId);

    const response = await this.request(`/group/${encodeURIComponent(groupId)}`, "DELETE");
    const parsed = this.parseResponse(resultSchema, response);
    if (!parsed.success) {
      throw new GraphitiProviderError("http", "Graphiti reported a group deletion failure");
    }
  }

  async health(): Promise<{ ok: boolean; latencyMs: number }> {
    const startedAt = Date.now();
    await this.request("/healthcheck", "GET");
    return { ok: true, latencyMs: Date.now() - startedAt };
  }

  private async request(
    path: string,
    method: "DELETE" | "GET" | "POST",
    body?: unknown,
  ): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": this.config.apiKey,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new GraphitiProviderError("http", `Graphiti request failed with status ${response.status}`);
      }

      try {
        return await response.json();
      } catch {
        throw new GraphitiProviderError("invalid_response", "Graphiti returned an invalid JSON response");
      }
    } catch (error) {
      if (error instanceof GraphitiProviderError) throw error;
      if (timedOut || controller.signal.aborted) {
        throw new GraphitiProviderError("timeout", "Graphiti request timed out");
      }
      // No retry here by design: writes are protected by the MERGE-on-uuid
      // idempotency above and ledger/event-log retry ownership sits outside
      // this client; a synchronous search has no safe automatic retry path.
      throw new GraphitiProviderError("request", "Graphiti request failed");
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseResponse<T>(schema: z.ZodType<T>, response: unknown): T {
    const parsed = schema.safeParse(response);
    if (!parsed.success) {
      throw new GraphitiProviderError("invalid_response", "Graphiti returned an unexpected response");
    }
    return parsed.data;
  }
}
