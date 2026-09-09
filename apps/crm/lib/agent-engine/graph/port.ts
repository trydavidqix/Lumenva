import { z } from "zod";

import {
  graphEpisodeSchema,
  graphSearchInputSchema,
  organizationIdSchema,
  type GraphEpisode,
  type GraphFact,
  type GraphSearchInput,
} from "./types";

/**
 * Port to the temporal graph projection (Graphiti/FalkorDB, Phase 4).
 *
 * Doctrine binding on every implementation, not just this contract:
 * - the feature starts OFF, then SHADOW; no `GraphFact` this port returns may
 *   by itself authorize a HIGH-risk action;
 * - `group_id` is derived from `organizationId` inside the trusted adapter —
 *   it is never caller-supplied and never appears in this interface;
 * - there is no public Graphiti/FalkorDB port in production;
 * - adapters ingest curated/sanitized event text, never secrets/raw
 *   credentials or arbitrary DB dumps.
 */
export interface GraphContextPort {
  addEpisode(episode: GraphEpisode, idempotencyKey: string): Promise<void>;
  search(input: GraphSearchInput): Promise<GraphFact[]>;
  deleteOrganization(organizationId: string): Promise<void>;
  health(): Promise<{ ok: boolean; latencyMs: number }>;
}

/**
 * Disabled adapter used when the temporal graph projection is not configured
 * or the feature is "off". Its health is deliberately a local marker: it does
 * not represent an external provider. `search` always returns no facts, so a
 * caller wired to this adapter can never have a graph result influence a
 * decision, HIGH-risk or otherwise.
 */
export class NullGraphContextPort implements GraphContextPort {
  async addEpisode(episode: GraphEpisode, idempotencyKey: string): Promise<void> {
    graphEpisodeSchema.parse(episode);
    z.string().min(1).parse(idempotencyKey);
  }

  async search(input: GraphSearchInput): Promise<GraphFact[]> {
    graphSearchInputSchema.parse(input);
    return [];
  }

  async deleteOrganization(organizationId: string): Promise<void> {
    organizationIdSchema.parse(organizationId);
  }

  async health(): Promise<{ ok: boolean; latencyMs: number }> {
    return { ok: true, latencyMs: 0 };
  }
}
